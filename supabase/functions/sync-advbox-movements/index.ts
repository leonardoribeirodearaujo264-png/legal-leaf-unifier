import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAdvboxRequest(endpoint: string, retryCount = 0): Promise<any> {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 5;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ADVBOX_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (response.status === 429 && retryCount < maxRetries) {
    const waitTime = Math.pow(2, retryCount) * 2000;
    console.log(`Rate limited. Waiting ${waitTime}ms`);
    await sleep(waitTime);
    return makeAdvboxRequest(endpoint, retryCount + 1);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }
  if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
    throw new Error('API returned non-JSON response');
  }
  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

  if (!isServiceRole) {
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 110000;

  try {
    let syncType = 'incremental';
    try {
      const body = await req.json();
      syncType = body?.sync_type || 'incremental';
    } catch { /* */ }

    console.log(`Starting ${syncType} sync of ADVBox movements...`);

    const { data: syncRecord } = await supabase
      .from('advbox_movements_sync_status')
      .insert({ sync_type: syncType, status: 'running', started_at: new Date().toISOString() })
      .select('id')
      .single();
    const syncId = syncRecord?.id;

    let allMovements: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = 80;
    const DELAY_BETWEEN_REQUESTS = 2100;

    // Para incremental, limitamos aos últimos 90 dias
    const endpoint = syncType === 'full' ? '/last_movements' : '/last_movements';

    while (hasMore && iterations < maxIterations) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('Approaching timeout, stopping fetch loop');
        break;
      }
      if (iterations > 0) await sleep(DELAY_BETWEEN_REQUESTS);

      console.log(`Fetching movements offset=${offset}...`);
      const response = await makeAdvboxRequest(`${endpoint}?limit=${limit}&offset=${offset}`);
      const items = response.data || [];
      totalCount = response.totalCount || totalCount || items.length;

      if (items.length === 0) {
        hasMore = false;
      } else {
        allMovements = allMovements.concat(items);
        offset += items.length;
        iterations++;
        if (items.length < limit || allMovements.length >= totalCount) hasMore = false;
      }

      if (syncId) {
        await supabase.from('advbox_movements_sync_status')
          .update({ last_offset: offset, total_synced: allMovements.length, total_count: totalCount })
          .eq('id', syncId);
      }
    }

    console.log(`Fetched ${allMovements.length} movements in ${iterations} iterations`);

    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < allMovements.length; i += batchSize) {
      const batch = allMovements.slice(i, i + batchSize)
        .filter((m: any) => m.id != null)
        .map((m: any) => ({
          advbox_id: m.id,
          lawsuit_id: m.lawsuit_id || m.lawsuits_id || null,
          lawsuit_number: m.process_number || m.lawsuit?.process_number || null,
          date: m.date || m.created_at || null,
          content: m.title || m.header || m.content || m.description || null,
          type: m.type || null,
          raw_data: m,
          last_synced_at: new Date().toISOString(),
        }));

      if (batch.length === 0) continue;

      const { error } = await supabase
        .from('advbox_movements')
        .upsert(batch, { onConflict: 'advbox_id' });
      if (error) {
        console.error(`Batch upsert error at ${i}:`, error);
        throw error;
      }
      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${allMovements.length} movements`);
    }

    if (syncId) {
      await supabase.from('advbox_movements_sync_status')
        .update({
          status: 'completed',
          total_synced: upsertedCount,
          total_count: totalCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId);
    }

    console.log(`Sync completed: ${upsertedCount} movements upserted`);

    return new Response(JSON.stringify({
      success: true,
      total_fetched: allMovements.length,
      total_upserted: upsertedCount,
      total_count: totalCount,
      iterations,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

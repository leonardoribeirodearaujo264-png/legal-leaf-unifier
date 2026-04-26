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

function extractNames(arr: any): string {
  if (!arr) return '';
  if (typeof arr === 'string') return arr;
  if (Array.isArray(arr)) {
    return arr.map((x: any) => x?.name || '').filter(Boolean).join(', ');
  }
  if (typeof arr === 'object' && arr.name) return arr.name;
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth permissiva: verify_jwt=false + anon-key-gateway é suficiente.
  // Mesmo padrão de sync-advbox-tasks. O cron dispara com anon key.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 110000;

  try {
    let syncType = 'incremental';
    try {
      const body = await req.json();
      syncType = body?.sync_type || 'incremental';
    } catch { /* */ }

    console.log(`Starting ${syncType} sync of ADVBox lawsuits...`);

    const { data: syncRecord } = await supabase
      .from('advbox_lawsuits_sync_status')
      .insert({ sync_type: syncType, status: 'running', started_at: new Date().toISOString() })
      .select('id')
      .single();
    const syncId = syncRecord?.id;

    let allLawsuits: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = 100;
    const DELAY_BETWEEN_REQUESTS = 2100;

    while (hasMore && iterations < maxIterations) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('Approaching timeout, stopping fetch loop');
        break;
      }
      if (iterations > 0) await sleep(DELAY_BETWEEN_REQUESTS);

      console.log(`Fetching lawsuits offset=${offset}...`);
      const response = await makeAdvboxRequest(`/lawsuits?limit=${limit}&offset=${offset}`);
      const items = response.data || [];
      totalCount = response.totalCount || totalCount || items.length;

      if (items.length === 0) {
        hasMore = false;
      } else {
        allLawsuits = allLawsuits.concat(items);
        offset += items.length;
        iterations++;
        if (items.length < limit || allLawsuits.length >= totalCount) hasMore = false;
      }

      if (syncId) {
        await supabase.from('advbox_lawsuits_sync_status')
          .update({ last_offset: offset, total_synced: allLawsuits.length, total_count: totalCount })
          .eq('id', syncId);
      }
    }

    console.log(`Fetched ${allLawsuits.length} lawsuits in ${iterations} iterations`);

    // Upsert in batches of 500
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < allLawsuits.length; i += batchSize) {
      const batch = allLawsuits.slice(i, i + batchSize).map((l: any) => {
        const customers = l.customers ?? [];
        const lawyers = l.lawyers ?? l.responsibles ?? [];
        const customerNames = extractNames(customers);
        const lawyerNames = extractNames(lawyers);
        return {
          advbox_id: l.id,
          number: l.process_number || l.number || null,
          folder: l.folder || null,
          distribution_date: l.process_date || l.distribution_date || l.created_at?.substring(0, 10) || null,
          status: l.status_closure || l.status || null,
          area: l.group || l.area || null,
          court: l.type || l.court || null,
          customers: Array.isArray(customers) ? customers : [customers].filter(Boolean),
          lawyers: Array.isArray(lawyers) ? lawyers : [lawyers].filter(Boolean),
          customer_names: customerNames,
          lawyer_names: lawyerNames,
          raw_data: l,
          last_synced_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('advbox_lawsuits')
        .upsert(batch, { onConflict: 'advbox_id' });
      if (error) {
        console.error(`Batch upsert error at ${i}:`, error);
        throw error;
      }
      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${allLawsuits.length} lawsuits`);
    }

    if (syncId) {
      await supabase.from('advbox_lawsuits_sync_status')
        .update({
          status: 'completed',
          total_synced: upsertedCount,
          total_count: totalCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId);
    }

    console.log(`Sync completed: ${upsertedCount} lawsuits upserted`);

    return new Response(JSON.stringify({
      success: true,
      total_fetched: allLawsuits.length,
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

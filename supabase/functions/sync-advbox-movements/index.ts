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

/**
 * Gera advbox_id sintético determinístico para movimentos.
 * O payload /last_movements do ADVBox NÃO traz id próprio — então usamos
 * SHA-256 de (lawsuit_id + date + title + header + process_number) truncado
 * para 63 bits (caber em BIGINT positivo). Determinístico = mesma movimentação
 * sempre gera o mesmo id, garantindo idempotência do upsert.
 */
async function syntheticId(m: any): Promise<bigint> {
  const key = [
    m.lawsuit_id ?? '',
    m.date ?? '',
    m.title ?? '',
    m.header ?? '',
    m.process_number ?? '',
  ].join('|');
  const buf = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const view = new DataView(hash);
  // Pega 8 primeiros bytes como BigInt e mascara o bit alto p/ ficar positivo
  const high = view.getBigUint64(0, false);
  return high & ((1n << 63n) - 1n);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Resume from last incomplete sync if exists.
    // CRITICAL: aplicamos resume tanto para 'full' quanto 'incremental', senão o cron
    // (que dispara incremental) reinicia sempre do offset 0 e trava em ~3.300 por timeout.
    let resumeOffset = 0;
    {
      const { data: lastIncomplete } = await supabase
        .from('advbox_movements_sync_status')
        .select('id, last_offset, total_count')
        .in('status', ['running', 'partial'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastIncomplete?.last_offset && lastIncomplete.last_offset < (lastIncomplete.total_count ?? Infinity)) {
        resumeOffset = lastIncomplete.last_offset;
        console.log(`Resuming ${syncType} sync from offset=${resumeOffset}`);
      }
    }

    const { data: syncRecord } = await supabase
      .from('advbox_movements_sync_status')
      .insert({ sync_type: syncType, status: 'running', started_at: new Date().toISOString(), last_offset: resumeOffset })
      .select('id')
      .single();
    const syncId = syncRecord?.id;

    let allMovements: any[] = [];
    let offset = resumeOffset;
    const limit = 100;
    let hasMore = true;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = 200;
    const DELAY_BETWEEN_REQUESTS = 2100;

    // Cursor pagination: ADVBox bloqueia offset > 10000.
    // Quando ultrapassamos, alternamos para `cursor` retornado pela API.
    let cursor: string | null = null;
    {
      const { data: lastIncomplete } = await supabase
        .from('advbox_movements_sync_status')
        .select('last_cursor')
        .in('status', ['running', 'partial'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cursor = lastIncomplete?.last_cursor ?? null;
    }
    const useCursor = () => offset >= 10000 || cursor !== null;

    while (hasMore && iterations < maxIterations) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`Approaching timeout, stopping at offset=${offset} cursor=${cursor}`);
        break;
      }
      if (iterations > 0) await sleep(DELAY_BETWEEN_REQUESTS);

      // Monta endpoint conforme estratégia de paginação
      let endpoint: string;
      if (useCursor()) {
        endpoint = `/last_movements?limit=${limit}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
        console.log(`Fetching movements via cursor=${cursor ?? '(initial)'}...`);
      } else {
        endpoint = `/last_movements?limit=${limit}&offset=${offset}`;
        console.log(`Fetching movements offset=${offset}...`);
      }
      const response = await makeAdvboxRequest(endpoint);
      const items = response.data || [];
      totalCount = response.totalCount || totalCount || items.length;
      // Cursor para próxima página (nomes possíveis na API ADVBox v1.2)
      const nextCursor: string | null = response.next_cursor ?? response.cursor ?? response.meta?.next_cursor ?? null;

      if (items.length === 0) {
        hasMore = false;
      } else {
        allMovements = allMovements.concat(items);
        offset += items.length;
        iterations++;
        if (items.length < limit) hasMore = false;
        // Quando estamos em cursor mode, hasMore depende do nextCursor existir
        if (useCursor() && !nextCursor) hasMore = false;
        cursor = nextCursor;
      }

      if (syncId) {
        await supabase.from('advbox_movements_sync_status')
          .update({
            last_offset: offset,
            last_cursor: cursor,
            use_cursor: useCursor(),
            total_synced: allMovements.length,
            total_count: totalCount,
          })
          .eq('id', syncId);
      }
    }

    console.log(`Fetched ${allMovements.length} movements in ${iterations} iterations`);

    if (allMovements.length > 0) {
      console.log('Sample movement keys:', Object.keys(allMovements[0]).join(','));
    }

    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < allMovements.length; i += batchSize) {
      const slice = allMovements.slice(i, i + batchSize);
      const batch: any[] = [];
      for (const m of slice) {
        // Tenta usar id real primeiro; se não houver, gera hash determinístico.
        let advboxId: bigint | number | null = m.id ?? m.movement_id ?? m._id ?? null;
        if (advboxId == null) {
          advboxId = await syntheticId(m);
        }
        batch.push({
          advbox_id: typeof advboxId === 'bigint' ? advboxId.toString() : advboxId,
          lawsuit_id: m.lawsuit_id ?? m.lawsuits_id ?? m.lawsuit?.id ?? null,
          lawsuit_number: m.process_number ?? m.lawsuit?.process_number ?? null,
          date: m.date ?? m.date_deadline ?? m.created_at ?? null,
          content: m.title ?? m.header ?? m.content ?? m.description ?? null,
          type: m.type ?? null,
          raw_data: m,
          last_synced_at: new Date().toISOString(),
        });
      }

      if (batch.length === 0) continue;

      const { error } = await supabase.from('advbox_movements').upsert(batch, { onConflict: 'advbox_id' });
      if (error) { console.error(`Batch upsert error at ${i}:`, error); throw error; }
      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${allMovements.length} movements`);
    }

    const finalStatus = (Date.now() - startTime > MAX_RUNTIME_MS && hasMore) ? 'partial' : 'completed';
    if (syncId) {
      await supabase.from('advbox_movements_sync_status')
        .update({
          status: finalStatus,
          total_synced: upsertedCount,
          total_count: totalCount,
          last_offset: offset,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId);
    }

    // Auditoria de paridade ADVBox vs local
    const { count: localCount } = await supabase
      .from('advbox_movements')
      .select('*', { count: 'exact', head: true });
    await supabase.from('advbox_sync_audit').insert({
      entity: 'movements',
      advbox_count: totalCount,
      local_count: localCount ?? 0,
      notes: `sync_type=${syncType}, status=${finalStatus}, offset=${offset}, cursor=${cursor ?? ''}`,
    });

    console.log(`Sync ${finalStatus}: ${upsertedCount} movements upserted (offset=${offset}/${totalCount}, local=${localCount})`);

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      total_fetched: allMovements.length,
      total_upserted: upsertedCount,
      total_count: totalCount,
      iterations,
      next_offset: hasMore ? offset : null,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

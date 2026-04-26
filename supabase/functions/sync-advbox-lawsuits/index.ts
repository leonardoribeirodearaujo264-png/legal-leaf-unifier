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

// Faz request com retry exponencial em caso de 429 (rate limit)
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

// Extrai nomes de array de objetos (customers, lawyers)
function extractNames(arr: any): string {
  if (!arr) return '';
  if (typeof arr === 'string') return arr;
  if (Array.isArray(arr)) {
    return arr.map((x: any) => x?.name || '').filter(Boolean).join(', ');
  }
  if (typeof arr === 'object' && arr.name) return arr.name;
  return '';
}

// Converte string vazia ou inválida para null antes de cast numérico/data
function nullIfEmpty(v: any): any {
  if (v === undefined || v === null || v === '') return null;
  return v;
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
    } catch { /* sem body */ }

    console.log(`Starting ${syncType} sync of ADVBox lawsuits...`);

    // RESUME UNIVERSAL: aplica para qualquer sync_type (igual ao fix de movements).
    // Sem isso o cron incremental reinicia do offset 0 e nunca chega ao fim.
    let resumeOffset = 0;
    {
      const { data: lastIncomplete } = await supabase
        .from('advbox_lawsuits_sync_status')
        .select('id, last_offset, total_synced, total_count')
        .in('status', ['running', 'partial'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastIncomplete?.last_offset && lastIncomplete.last_offset < (lastIncomplete.total_count ?? Infinity)) {
        resumeOffset = lastIncomplete.last_offset;
        console.log(`Resuming ${syncType} sync from offset=${resumeOffset} (was ${lastIncomplete.total_synced}/${lastIncomplete.total_count})`);
      }
    }

    const { data: syncRecord } = await supabase
      .from('advbox_lawsuits_sync_status')
      .insert({ sync_type: syncType, status: 'running', started_at: new Date().toISOString(), last_offset: resumeOffset })
      .select('id')
      .single();
    const syncId = syncRecord?.id;

    let allLawsuits: any[] = [];
    let offset = resumeOffset;
    const limit = 100;
    let hasMore = true;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = 200;
    const DELAY_BETWEEN_REQUESTS = 2100;

    while (hasMore && iterations < maxIterations) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`Approaching timeout, stopping at offset=${offset}`);
        break;
      }
      // Detecta limite de offset da API ADVBox (10k). Acima disso só cursor pagination resolve.
      if (offset >= 10000) {
        console.log(`Reached ADVBox offset limit (10000) at offset=${offset}. Stopping.`);
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
        if (items.length < limit) hasMore = false;
        if (totalCount > 0 && offset >= totalCount) hasMore = false;
      }

      if (syncId) {
        await supabase.from('advbox_lawsuits_sync_status')
          .update({ last_offset: offset, total_synced: allLawsuits.length, total_count: totalCount })
          .eq('id', syncId);
      }
    }

    console.log(`Fetched ${allLawsuits.length} lawsuits in ${iterations} iterations`);

    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < allLawsuits.length; i += batchSize) {
      const batch = allLawsuits.slice(i, i + batchSize).map((l: any) => {
        const customers = l.customers ?? [];
        const lawyers = l.lawyers ?? l.responsibles ?? [];
        const customerNames = extractNames(customers);
        const lawyerNames = extractNames(lawyers);
        const partiesText = `${customerNames} ${lawyerNames}`.trim();

        // Mapeia campos canônicos do raw_data ADVBox para colunas tipadas.
        // Critério "Em andamento" do ADVBox = step NOT IN (ARQUIVAMENTO, MARKETING, RH/FINANCEIRO)
        // E movimentação <120d (calculado depois via UPDATE).
        const step = l.step ?? null;
        return {
          advbox_id: l.id,
          number: l.process_number || l.number || null,
          folder: l.folder || null,
          distribution_date: nullIfEmpty(l.process_date) || nullIfEmpty(l.distribution_date) || (l.created_at ? l.created_at.substring(0, 10) : null),
          status: l.status_closure || null, // mantém compatibilidade
          area: l.group || l.area || null,
          court: l.type || l.court || null,
          // Novos campos canônicos
          step,
          step_id: nullIfEmpty(l.steps_id),
          stage: l.stage ?? null,
          stage_id: nullIfEmpty(l.stages_id),
          group_name: l.group ?? null,
          group_id: nullIfEmpty(l.group_id),
          type_acao: l.type ?? null,
          type_lawsuit_id: nullIfEmpty(l.type_lawsuit_id),
          responsible_name: l.responsible ?? null,
          responsible_id: nullIfEmpty(l.responsible_id),
          process_date: nullIfEmpty(l.process_date),
          fees_money: nullIfEmpty(l.fees_money),
          fees_expec: nullIfEmpty(l.fees_expec),
          contingency: l.contingency ?? null,
          protocol_number: l.protocol_number ?? null,
          notes: l.notes ?? null,
          customers: Array.isArray(customers) ? customers : [customers].filter(Boolean),
          lawyers: Array.isArray(lawyers) ? lawyers : [lawyers].filter(Boolean),
          customer_names: customerNames,
          lawyer_names: lawyerNames,
          parties_text: partiesText,
          // is_active recalculado em SQL após upsert (depende de last_movement_at)
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

    // Recalcula is_active dos registros afetados.
    // Critério "Em andamento" do ADVBox: step ativo E movimentação <120d.
    // Como o SDK não permite expressões SQL no update, marcamos em 2 passes server-side:
    //   1) is_active = false para step arquivado/marketing/RH
    //   2) is_active = true para steps ativos com movimentação recente
    if (upsertedCount > 0) {
      await supabase.from('advbox_lawsuits')
        .update({ is_active: false })
        .in('step', ['ARQUIVAMENTO','MARKETING','RH/FINANCEIRO']);
      const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('advbox_lawsuits')
        .update({ is_active: true })
        .not('step','in','("ARQUIVAMENTO","MARKETING","RH/FINANCEIRO")')
        .gte('last_movement_at', cutoff);
    }

    const finalStatus = (Date.now() - startTime > MAX_RUNTIME_MS && hasMore) ? 'partial' : 'completed';
    if (syncId) {
      await supabase.from('advbox_lawsuits_sync_status')
        .update({
          status: finalStatus,
          total_synced: upsertedCount,
          total_count: totalCount,
          last_offset: offset,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId);
    }

    // Auditoria de paridade
    const { count: localCount } = await supabase
      .from('advbox_lawsuits')
      .select('*', { count: 'exact', head: true });
    await supabase.from('advbox_sync_audit').insert({
      entity: 'lawsuits',
      advbox_count: totalCount,
      local_count: localCount ?? 0,
      notes: `sync_type=${syncType}, status=${finalStatus}, offset=${offset}`,
    });

    console.log(`Sync ${finalStatus}: ${upsertedCount} lawsuits upserted (offset=${offset}/${totalCount}, local=${localCount})`);

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      total_fetched: allLawsuits.length,
      total_upserted: upsertedCount,
      total_count: totalCount,
      local_count: localCount,
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

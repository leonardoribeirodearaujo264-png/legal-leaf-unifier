// Edge function: advbox-write-lancamento
// Bidirectional sync: writes a fin_lancamento to ADVBox /financial endpoint.
// Controlled by fin_settings.writeback_enabled flag (default OFF).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WritebackPayload {
  lancamento_id?: string;
  test_mode?: boolean;
  create_test_record?: boolean;
}

async function logWriteback(
  supabase: any,
  data: {
    lancamento_id?: string | null;
    advbox_id?: number | null;
    status: 'success' | 'error' | 'skipped' | 'disabled';
    request_payload?: any;
    response_payload?: any;
    error_message?: string | null;
    http_status?: number | null;
    triggered_by?: string | null;
  }
) {
  try {
    await supabase.from('fin_advbox_writeback_logs').insert({
      lancamento_id: data.lancamento_id ?? null,
      advbox_id: data.advbox_id ?? null,
      status: data.status,
      request_payload: data.request_payload ?? null,
      response_payload: data.response_payload ?? null,
      error_message: data.error_message ?? null,
      http_status: data.http_status ?? null,
      triggered_by: data.triggered_by ?? null,
    });
  } catch (e) {
    console.error('[writeback] Erro ao gravar log:', e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const advboxToken = Deno.env.get('ADVBOX_API_TOKEN');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let triggeredBy: string | null = null;
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      triggeredBy = user?.id ?? null;
    }
  } catch (_e) {
    // ignore
  }

  let body: WritebackPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.lancamento_id) {
    return new Response(
      JSON.stringify({ error: 'lancamento_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Carregar settings
  const { data: settings } = await supabase
    .from('fin_settings')
    .select('writeback_enabled, writeback_test_mode')
    .eq('id', 'singleton')
    .maybeSingle();

  const writebackEnabled = settings?.writeback_enabled === true;
  const testMode = body.test_mode ?? settings?.writeback_test_mode === true;

  if (!writebackEnabled && !testMode) {
    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      status: 'disabled',
      error_message: 'Writeback desabilitado em fin_settings',
      triggered_by: triggeredBy,
    });
    return new Response(
      JSON.stringify({
        success: false,
        skipped: true,
        reason: 'writeback_disabled',
        message: 'Writeback ADVBox está desabilitado. Habilite em /financeiro/admin → Diagnóstico ADVBOX.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Buscar lançamento + conta + categoria
  const { data: lanc, error: lancErr } = await supabase
    .from('fin_lancamentos')
    .select(`
      id, tipo, valor, descricao, observacoes,
      data_vencimento, data_pagamento, status,
      conta_origem_id, conta_destino_id, advbox_id,
      conta:fin_contas!fin_lancamentos_conta_origem_id_fkey(id, nome, advbox_account_id),
      categoria:fin_categorias(id, nome)
    `)
    .eq('id', body.lancamento_id)
    .maybeSingle();

  if (lancErr || !lanc) {
    const msg = lancErr?.message || 'Lançamento não encontrado';
    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      status: 'error',
      error_message: msg,
      triggered_by: triggeredBy,
    });
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const conta: any = lanc.conta;
  const advboxAccountId = conta?.advbox_account_id ?? null;

  if (!advboxAccountId) {
    const msg = 'Conta sem advbox_account_id vinculado';
    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      status: 'skipped',
      error_message: msg,
      triggered_by: triggeredBy,
    });
    return new Response(
      JSON.stringify({ success: false, skipped: true, reason: 'no_advbox_account', message: msg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Mapear payload para ADVBox /financial
  const requestPayload = {
    type: lanc.tipo === 'receita' ? 'income' : 'expense',
    value: Number(lanc.valor),
    description: lanc.descricao,
    due_date: lanc.data_vencimento,
    payment_date: lanc.data_pagamento ?? null,
    bank_account_id: advboxAccountId,
    category: (lanc.categoria as any)?.nome ?? null,
    paid: lanc.status === 'pago',
    notes: lanc.observacoes ?? null,
    external_reference: `intranet:${lanc.id}`,
  };

  if (testMode) {
    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      status: 'success',
      request_payload: { ...requestPayload, _test_mode: true },
      response_payload: { simulated: true, note: 'TEST MODE - nenhuma chamada real ao ADVBox' },
      triggered_by: triggeredBy,
    });
    return new Response(
      JSON.stringify({
        success: true,
        test_mode: true,
        request_payload: requestPayload,
        message: 'TEST MODE - lançamento simulado, nenhuma chamada real ao ADVBox',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!advboxToken) {
    const msg = 'ADVBOX_API_TOKEN não configurado';
    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      status: 'error',
      request_payload: requestPayload,
      error_message: msg,
      triggered_by: triggeredBy,
    });
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // POST real para o ADVBox
  let advboxResponse: any = null;
  let httpStatus = 0;
  try {
    const resp = await fetch('https://app.advbox.com.br/api/v1/financial', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${advboxToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
    httpStatus = resp.status;
    const ct = resp.headers.get('content-type') ?? '';
    advboxResponse = ct.includes('application/json') ? await resp.json() : await resp.text();

    if (!resp.ok) {
      const errMsg = `ADVBox retornou ${resp.status}: ${typeof advboxResponse === 'string' ? advboxResponse : JSON.stringify(advboxResponse)}`;
      await logWriteback(supabase, {
        lancamento_id: body.lancamento_id,
        status: 'error',
        request_payload: requestPayload,
        response_payload: advboxResponse,
        error_message: errMsg,
        http_status: httpStatus,
        triggered_by: triggeredBy,
      });
      return new Response(
        JSON.stringify({ success: false, error: errMsg, http_status: httpStatus }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const advboxId = advboxResponse?.id ?? advboxResponse?.data?.id ?? null;

    if (advboxId) {
      await supabase
        .from('fin_lancamentos')
        .update({ advbox_id: advboxId })
        .eq('id', body.lancamento_id);
    }

    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      advbox_id: advboxId,
      status: 'success',
      request_payload: requestPayload,
      response_payload: advboxResponse,
      http_status: httpStatus,
      triggered_by: triggeredBy,
    });

    return new Response(
      JSON.stringify({
        success: true,
        advbox_id: advboxId,
        http_status: httpStatus,
        response: advboxResponse,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await logWriteback(supabase, {
      lancamento_id: body.lancamento_id,
      status: 'error',
      request_payload: requestPayload,
      error_message: errMsg,
      http_status: httpStatus,
      triggered_by: triggeredBy,
    });
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

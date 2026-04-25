// Edge function: advbox-write-lancamento
// Bidirectional sync: writes a fin_lancamento to ADVBox /financial endpoint.
// Controlled by fin_settings.writeback_enabled flag (default OFF).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-auth',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
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
      return json({ error: 'Invalid JSON body' }, 400);
    }

    let lancamentoId: string | undefined = body.lancamento_id;

    if (!lancamentoId && !body.create_test_record) {
      return json(
        { error: 'lancamento_id is required (or set create_test_record=true)' },
        400
      );
    }

    // Caso especial: criar lançamento de teste R$ 1,00 (bypassa RLS via service role)
    if (body.create_test_record) {
      const { data: contaAsaas, error: contaErr } = await supabase
        .from('fin_contas')
        .select('id')
        .ilike('nome', '%asaas%')
        .limit(1)
        .maybeSingle();

      if (contaErr || !contaAsaas) {
        return json({ error: 'Conta Asaas nao encontrada para teste' }, 404);
      }

      // Fallback: se não veio user na auth, buscar Rafael (criador) para satisfazer NOT NULL
      let createdByForTest = triggeredBy;
      if (!createdByForTest) {
        const { data: rafael } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', 'rafael@eggnunes.com.br')
          .maybeSingle();
        createdByForTest = rafael?.id ?? null;
      }

      const today = new Date().toISOString().slice(0, 10);
      const { data: testLanc, error: insertErr } = await supabase
        .from('fin_lancamentos')
        .insert({
          tipo: 'receita',
          valor: 1.00,
          descricao: 'TESTE WRITEBACK ADVBox - ' + new Date().toISOString(),
          data_vencimento: today,
          data_pagamento: today,
          status: 'pago',
          conta_origem_id: contaAsaas.id,
          observacoes: 'Lancamento de teste do writeback bidirecional',
          created_by: createdByForTest,
        })
        .select('id')
        .single();

      if (insertErr || !testLanc) {
        const msg = insertErr?.message || 'Falha ao criar lancamento de teste';
        await logWriteback(supabase, {
          status: 'error',
          error_message: 'create_test_record: ' + msg,
          triggered_by: triggeredBy,
        });
        return json({ success: false, error: msg }, 500);
      }

      lancamentoId = testLanc.id;
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
        lancamento_id: lancamentoId,
        status: 'disabled',
        error_message: 'Writeback desabilitado em fin_settings',
        triggered_by: triggeredBy,
      });
      return json(
        {
          success: false,
          skipped: true,
          reason: 'writeback_disabled',
          message: 'Writeback ADVBox está desabilitado. Habilite em /financeiro/admin → Diagnóstico ADVBOX.',
        },
        200
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
      .eq('id', lancamentoId)
      .maybeSingle();

    if (lancErr || !lanc) {
      const msg = lancErr?.message || 'Lançamento não encontrado';
      await logWriteback(supabase, {
        lancamento_id: lancamentoId,
        status: 'error',
        error_message: msg,
        triggered_by: triggeredBy,
      });
      return json({ success: false, error: msg }, 404);
    }

    const conta: any = lanc.conta;
    const advboxAccountId = conta?.advbox_account_id ?? null;

    if (!advboxAccountId) {
      const msg = 'Conta sem advbox_account_id vinculado';
      await logWriteback(supabase, {
        lancamento_id: lancamentoId,
        status: 'skipped',
        error_message: msg,
        triggered_by: triggeredBy,
      });
      return json(
        { success: false, skipped: true, reason: 'no_advbox_account', message: msg },
        200
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
        lancamento_id: lancamentoId,
        status: 'success',
        request_payload: { ...requestPayload, _test_mode: true },
        response_payload: { simulated: true, note: 'TEST MODE - nenhuma chamada real ao ADVBox' },
        triggered_by: triggeredBy,
      });
      return json(
        {
          success: true,
          test_mode: true,
          request_payload: requestPayload,
          message: 'TEST MODE - lançamento simulado, nenhuma chamada real ao ADVBox',
        },
        200
      );
    }

    if (!advboxToken) {
      const msg = 'ADVBOX_API_TOKEN não configurado';
      await logWriteback(supabase, {
        lancamento_id: lancamentoId,
        status: 'error',
        request_payload: requestPayload,
        error_message: msg,
        triggered_by: triggeredBy,
      });
      return json({ success: false, error: msg }, 500);
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
          lancamento_id: lancamentoId,
          status: 'error',
          request_payload: requestPayload,
          response_payload: advboxResponse,
          error_message: errMsg,
          http_status: httpStatus,
          triggered_by: triggeredBy,
        });
        return json({ success: false, error: errMsg, http_status: httpStatus }, 502);
      }

      const advboxId = advboxResponse?.id ?? advboxResponse?.data?.id ?? null;

      if (advboxId) {
        await supabase
          .from('fin_lancamentos')
          .update({ advbox_id: advboxId })
          .eq('id', lancamentoId);
      }

      await logWriteback(supabase, {
        lancamento_id: lancamentoId,
        advbox_id: advboxId,
        status: 'success',
        request_payload: requestPayload,
        response_payload: advboxResponse,
        http_status: httpStatus,
        triggered_by: triggeredBy,
      });

      return json(
        {
          success: true,
          advbox_id: advboxId,
          http_status: httpStatus,
          response: advboxResponse,
        },
        200
      );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await logWriteback(supabase, {
        lancamento_id: lancamentoId,
        status: 'error',
        request_payload: requestPayload,
        error_message: errMsg,
        http_status: httpStatus,
        triggered_by: triggeredBy,
      });
      return json({ success: false, error: errMsg }, 500);
    }
  } catch (e) {
    // Catch global - NUNCA deixar o request explodir sem CORS
    console.error('advbox-write-lancamento error:', e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return json({ error: errMsg || 'unknown error' }, 500);
  }
});

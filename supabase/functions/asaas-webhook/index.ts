import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

interface AsaasPaymentData {
  id: string;
  customer: string;
  installment?: string;
  subscription?: string;
  value: number;
  netValue?: number;
  originalValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  confirmedDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeId?: string;
  nossoNumero?: string;
  clientPaymentDate?: string;
}

interface AsaasInvoiceData {
  id: string;
  payment?: string;
  customer: string;
  value: number;
  status: string;
  serviceDescription?: string;
  observations?: string;
  externalReference?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  scheduledDate?: string;
  authorizedDate?: string;
  canceledDate?: string;
  errorMessage?: string;
}

interface AsaasTransferData {
  id: string;
  value: number;
  netValue?: number;
  transferFee?: number;
  status: string;
  type?: string;
  bankAccount?: { id: string };
  operationType?: string;
  description?: string;
  scheduleDate?: string;
  transactionReceiptUrl?: string;
  effectiveDate?: string;
  failReason?: string;
}

interface AsaasInternalTransferData {
  id: string;
  type: string;
  value: number;
  status?: string;
  walletId?: string;
  description?: string;
}

interface AsaasApiKeyData {
  id?: string;
  name?: string;
  expirationDate?: string;
}

interface AsaasWebhookPayload {
  event: string;
  payment?: AsaasPaymentData;
  invoice?: AsaasInvoiceData;
  transfer?: AsaasTransferData;
  internalTransfer?: AsaasInternalTransferData;
  accessToken?: AsaasApiKeyData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Asaas Webhook received');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

    // Fail-closed: se o token não está configurado, rejeita em vez de
    // deixar passar. Antes o webhook aceitava tudo quando a env var
    // estava ausente.
    if (!ASAAS_WEBHOOK_TOKEN) {
      console.error('ASAAS_WEBHOOK_TOKEN não configurado — rejeitando webhook');
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = req.headers.get('asaas-access-token');
    if (authToken !== ASAAS_WEBHOOK_TOKEN) {
      console.error('Token de webhook inválido');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

    const payload: AsaasWebhookPayload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    const { event, payment, invoice, transfer, internalTransfer, accessToken } = payload;

    // Salvar evento no log
    const { data: eventLog, error: logError } = await supabase
      .from('asaas_webhook_events')
      .insert({
        event_type: event,
        payment_id: payment?.id,
        invoice_id: invoice?.id,
        installment_id: payment?.installment,
        customer_id: payment?.customer || invoice?.customer,
        subscription_id: payment?.subscription,
        transfer_id: transfer?.id || internalTransfer?.id,
        event_data: payload,
        processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Erro ao salvar log do evento:', logError);
    } else {
      console.log('Evento salvo no log:', eventLog?.id);
    }

    try {
      // Processar eventos de pagamento
      if (event.startsWith('PAYMENT_') && payment) {
        await processPaymentEvent(supabase, event, payment);
      }
      
      // Processar eventos de notas fiscais
      if (event.startsWith('INVOICE_') && invoice) {
        await processInvoiceEvent(supabase, event, invoice);
      }
      
      // Processar eventos de transferências
      if (event.startsWith('TRANSFER_') && transfer) {
        await processTransferEvent(supabase, event, transfer);
      }
      
      // Processar eventos de movimentações internas
      if (event.startsWith('INTERNAL_TRANSFER_') && internalTransfer) {
        await processInternalTransferEvent(supabase, event, internalTransfer);
      }
      
      // Processar eventos de chaves de API
      if (event.startsWith('ACCESS_TOKEN_') && accessToken) {
        await processApiKeyEvent(supabase, event, accessToken);
      }

      // Marcar como processado
      if (eventLog) {
        await supabase
          .from('asaas_webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', eventLog.id);
      }
    } catch (processError) {
      console.error('Erro ao processar evento:', processError);
      
      if (eventLog) {
        await supabase
          .from('asaas_webhook_events')
          .update({ 
            error_message: processError instanceof Error ? processError.message : 'Erro desconhecido'
          })
          .eq('id', eventLog.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro no webhook Asaas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPaymentEvent(supabase: any, event: string, payment: AsaasPaymentData) {
  console.log(`Processando evento ${event} para pagamento ${payment.id}`);

  const { data: existingLinks } = await supabase
    .from('asaas_payment_links')
    .select('*')
    .eq('asaas_payment_id', payment.id)
    .limit(1);

  const existingLink = existingLinks && existingLinks.length > 0 ? existingLinks[0] : null;

  const paymentLinkData = {
    asaas_payment_id: payment.id,
    asaas_installment_id: payment.installment || null,
    asaas_customer_id: payment.customer,
    value: payment.value,
    due_date: payment.dueDate,
    payment_date: payment.paymentDate || payment.confirmedDate || null,
    status: payment.status,
    billing_type: payment.billingType,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    updated_at: new Date().toISOString(),
  };

  if (existingLink) {
    await supabase
      .from('asaas_payment_links')
      .update(paymentLinkData)
      .eq('id', existingLink.id);
    
    console.log(`Link de pagamento atualizado: ${existingLink.id}`);

    // Atualizar status do lançamento se pagamento confirmado
    if (
      (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') &&
      existingLink.lancamento_id
    ) {
      await updateLancamentoStatus(supabase, existingLink.lancamento_id, 'pago', payment);
    }
    
    // Reverter status se pagamento estornado ou reembolsado
    if (
      (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_RECEIVED_IN_CASH_UNDONE') &&
      existingLink.lancamento_id
    ) {
      await updateLancamentoStatus(supabase, existingLink.lancamento_id, 'pendente', payment, 'Pagamento estornado/desfeito via Asaas');
    }
    
    // Marcar como vencido
    if (event === 'PAYMENT_OVERDUE' && existingLink.lancamento_id) {
      await updateLancamentoStatus(supabase, existingLink.lancamento_id, 'vencido', payment, 'Pagamento vencido - Asaas');
    }
  } else {
    const { data: newLinks, error } = await supabase
      .from('asaas_payment_links')
      .insert({
        ...paymentLinkData,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Erro ao criar link de pagamento:', error);
    } else if (newLinks && newLinks.length > 0) {
      console.log(`Novo link de pagamento criado: ${newLinks[0].id}`);
    }

    if (payment.externalReference) {
      await tryAutoLink(supabase, payment);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processInvoiceEvent(supabase: any, event: string, invoice: AsaasInvoiceData) {
  console.log(`Processando evento ${event} para nota fiscal ${invoice.id}`);

  const invoiceData = {
    asaas_invoice_id: invoice.id,
    asaas_payment_id: invoice.payment || null,
    customer_id: invoice.customer,
    value: invoice.value,
    status: invoice.status,
    service_description: invoice.serviceDescription || null,
    observations: invoice.observations || null,
    external_reference: invoice.externalReference || null,
    invoice_number: invoice.invoiceNumber || null,
    invoice_url: invoice.invoiceUrl || null,
    pdf_url: invoice.pdfUrl || null,
    xml_url: invoice.xmlUrl || null,
    scheduled_date: invoice.scheduledDate || null,
    authorized_date: invoice.authorizedDate || null,
    canceled_date: invoice.canceledDate || null,
    error_message: invoice.errorMessage || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('asaas_invoices')
    .select('id')
    .eq('asaas_invoice_id', invoice.id)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from('asaas_invoices')
      .update(invoiceData)
      .eq('asaas_invoice_id', invoice.id);
    console.log(`Nota fiscal atualizada: ${invoice.id}`);
  } else {
    await supabase
      .from('asaas_invoices')
      .insert({ ...invoiceData, created_at: new Date().toISOString() });
    console.log(`Nova nota fiscal criada: ${invoice.id}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processTransferEvent(supabase: any, event: string, transfer: AsaasTransferData) {
  console.log(`Processando evento ${event} para transferência ${transfer.id}`);

  const transferData = {
    asaas_transfer_id: transfer.id,
    value: transfer.value,
    net_value: transfer.netValue || null,
    transfer_fee: transfer.transferFee || null,
    status: transfer.status,
    transfer_type: transfer.type || null,
    bank_account_id: transfer.bankAccount?.id || null,
    operation_type: transfer.operationType || null,
    description: transfer.description || null,
    scheduled_date: transfer.scheduleDate || null,
    transaction_receipt_url: transfer.transactionReceiptUrl || null,
    effective_date: transfer.effectiveDate || null,
    failure_reason: transfer.failReason || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('asaas_transfers')
    .select('id')
    .eq('asaas_transfer_id', transfer.id)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from('asaas_transfers')
      .update(transferData)
      .eq('asaas_transfer_id', transfer.id);
    console.log(`Transferência atualizada: ${transfer.id}`);
  } else {
    await supabase
      .from('asaas_transfers')
      .insert({ ...transferData, created_at: new Date().toISOString() });
    console.log(`Nova transferência criada: ${transfer.id}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processInternalTransferEvent(supabase: any, event: string, transfer: AsaasInternalTransferData) {
  console.log(`Processando evento ${event} para movimentação interna ${transfer.id}`);

  const transferType = event === 'INTERNAL_TRANSFER_CREDIT' ? 'credit' : 'debit';

  const transferData = {
    asaas_transfer_id: transfer.id,
    transfer_type: transferType,
    value: transfer.value,
    status: transfer.status || 'completed',
    from_wallet_id: transferType === 'debit' ? transfer.walletId : null,
    to_wallet_id: transferType === 'credit' ? transfer.walletId : null,
    description: transfer.description || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('asaas_internal_transfers')
    .select('id')
    .eq('asaas_transfer_id', transfer.id)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from('asaas_internal_transfers')
      .update(transferData)
      .eq('asaas_transfer_id', transfer.id);
    console.log(`Movimentação interna atualizada: ${transfer.id}`);
  } else {
    await supabase
      .from('asaas_internal_transfers')
      .insert({ ...transferData, created_at: new Date().toISOString() });
    console.log(`Nova movimentação interna criada: ${transfer.id}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processApiKeyEvent(supabase: any, event: string, apiKey: AsaasApiKeyData) {
  console.log(`Processando evento ${event} para chave de API`);

  await supabase
    .from('asaas_api_key_alerts')
    .insert({
      event_type: event,
      api_key_id: apiKey.id || null,
      api_key_name: apiKey.name || null,
      expiration_date: apiKey.expirationDate || null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    
  console.log(`Alerta de chave de API criado: ${event}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateLancamentoStatus(
  supabase: any,
  lancamentoId: string,
  status: string,
  payment: AsaasPaymentData,
  customMessage?: string
) {
  console.log(`Atualizando status do lançamento ${lancamentoId} para ${status}`);

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'pago') {
    updateData.data_pagamento = payment.paymentDate || payment.confirmedDate || new Date().toISOString().split('T')[0];
    updateData.observacoes = `Pagamento confirmado via Asaas (${payment.billingType}) em ${new Date().toLocaleString('pt-BR')}`;
  } else {
    updateData.observacoes = customMessage || `Status atualizado via Asaas em ${new Date().toLocaleString('pt-BR')}`;
  }

  const { error } = await supabase
    .from('fin_lancamentos')
    .update(updateData)
    .eq('id', lancamentoId);

  if (error) {
    console.error('Erro ao atualizar lançamento:', error);
    throw error;
  }

  console.log(`Lançamento ${lancamentoId} atualizado para ${status}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryAutoLink(supabase: any, payment: AsaasPaymentData) {
  if (!payment.externalReference) return;

  console.log(`Tentando vincular pagamento ${payment.id} com referência externa ${payment.externalReference}`);

  const { data: lancamentos } = await supabase
    .from('fin_lancamentos')
    .select('id')
    .eq('id', payment.externalReference)
    .limit(1);

  if (lancamentos && lancamentos.length > 0) {
    const lancamento = lancamentos[0];
    await supabase
      .from('asaas_payment_links')
      .update({ lancamento_id: lancamento.id })
      .eq('asaas_payment_id', payment.id);

    console.log(`Pagamento ${payment.id} vinculado ao lançamento ${lancamento.id}`);
  }
}

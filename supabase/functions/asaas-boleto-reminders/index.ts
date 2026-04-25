import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { saveOutboundToWhatsApp } from '../_shared/whatsapp-sync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const WHATSAPP_OFICIAL = '553132268742';
const FOOTER_AVISO = `\n\n⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*\nPara entrar em contato conosco, utilize nosso canal oficial:\n📞 WhatsApp Oficial: https://wa.me/${WHATSAPP_OFICIAL}\n\n_Não responda esta mensagem._`;

// 3-minute interval between messages
const BULK_INTERVAL_MS = 3 * 60 * 1000;

// Brazilian phone validation
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

// Reminder schedule: negative = days before due, positive = days after due
const REMINDER_SCHEDULE = [
  { days: -10, type: 'before_10', label: '10 dias antes do vencimento' },
  { days: -5,  type: 'before_5',  label: '5 dias antes do vencimento' },
  { days: 0,   type: 'due_date',  label: 'no dia do vencimento' },
  { days: 2,   type: 'after_2',   label: '2 dias após o vencimento' },
  { days: 5,   type: 'after_5',   label: '5 dias após o vencimento' },
  { days: 10,  type: 'after_10',  label: '10 dias após o vencimento' },
];

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: ${phone}`);
  }
  return fullPhone;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function buildReminderMessage(customerName: string, value: number, dueDate: string, reminderType: string, invoiceUrl?: string): string {
  const firstName = customerName.split(' ')[0];
  const formattedValue = formatCurrency(value);
  const formattedDate = formatDate(dueDate);
  const linkPagamento = invoiceUrl ? `\n\nSegue o link para pagamento: ${invoiceUrl}` : '';

  switch (reminderType) {
    case 'before_10':
      return `Olá, *${firstName}*! 👋\n\nEste é um aviso do escritório *Egg Nunes Advogados Associados*.\n\nInformamos que você possui um boleto no valor de *${formattedValue}* com vencimento previsto para *${formattedDate}* (daqui a 10 dias).${linkPagamento}\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;

    case 'before_5':
      return `Olá, *${firstName}*! 👋\n\nLembrete do escritório *Egg Nunes Advogados Associados*:\n\nSeu boleto no valor de *${formattedValue}* vence em *${formattedDate}* (daqui a 5 dias).${linkPagamento}\n\nSe já efetuou o pagamento, desconsidere esta mensagem.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;

    case 'due_date':
      return `Olá, *${firstName}*! 👋\n\n*Lembrete* - *Egg Nunes Advogados Associados*\n\nSeu boleto no valor de *${formattedValue}* vence *hoje* (*${formattedDate}*).${linkPagamento}\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;

    case 'after_2':
      return `Olá, *${firstName}*! 👋\n\nInformamos que consta em nosso sistema um boleto no valor de *${formattedValue}* que venceu em *${formattedDate}* e encontra-se com *2 dias em atraso*.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. Caso contrário, pedimos a gentileza de regularizar o quanto antes para evitar encargos adicionais.${linkPagamento}\n\nAgradecemos a compreensão! 🙏\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;

    case 'after_5':
      return `Olá, *${firstName}*! 👋\n\nGostaríamos de informar que consta em nosso sistema um boleto pendente no valor de *${formattedValue}*, vencido em *${formattedDate}*, com *5 dias em atraso*.\n\nPedimos a gentileza de providenciar a regularização o mais breve possível para evitar demais encargos.${linkPagamento}\n\nCaso tenha alguma dúvida ou dificuldade, entre em contato conosco pelos nossos canais oficiais.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;

    case 'after_10':
      return `Prezado(a) *${firstName}*,\n\nInformamos que consta em nosso sistema uma pendência financeira referente ao boleto no valor de *${formattedValue}*, vencido em *${formattedDate}*, com *10 dias em atraso*.\n\nSolicitamos a regularização urgente desta pendência para evitar medidas administrativas adicionais.${linkPagamento}\n\nPara tratar sobre esta questão, entre em contato conosco através dos nossos canais oficiais.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;

    default:
      return `Olá, *${firstName}*! Este é um aviso do escritório *Egg Nunes Advogados Associados* sobre seu boleto no valor de *${formattedValue}* com vencimento em *${formattedDate}*.${linkPagamento}`;
  }
}

async function sendZAPIMessage(phone: string, message: string): Promise<{ zaapId?: string; success: boolean }> {
  const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
  const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
  const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

  console.log(`[Z-API] Credentials debug - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN.length}, Client Token length: ${ZAPI_CLIENT_TOKEN.length}`);

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    throw new Error('Credenciais da Z-API não configuradas');
  }

  const fullPhone = validateBrazilianPhone(phone);
  const fullMessage = message + FOOTER_AVISO;
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  console.log(`[Z-API] Sending message to ${fullPhone}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone: fullPhone, message: fullMessage }),
  });

  const responseText = await response.text();
  console.log(`[Z-API] Response status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Z-API error (${response.status}): ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Z-API returned invalid JSON: ${responseText.substring(0, 200)}`);
  }

  return { zaapId: data.zaapId || data.messageId, success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('=== Starting Asaas Boleto Reminders ===');

    // === Z-API SUSPENSO TEMPORARIAMENTE ===
    // O número de WhatsApp de avisos foi restrito pela Meta.
    // Envio suspenso até aquecimento do número. Aguardando reativação.
    console.log('⚠️ [SUSPENSO] Envio de lembretes de boleto via Z-API está temporariamente suspenso.');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Envio de lembretes de boleto está temporariamente suspenso. O número de WhatsApp de avisos está em processo de aquecimento.',
        suspended: true,
        sent: 0,
        failed: 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    // === FIM DA SUSPENSÃO ===

    // Check business hours (08:00-19:00 Brasília time - UTC-3)
    const nowBrasilia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentHour = nowBrasilia.getHours();
    console.log(`[Horário] Hora atual em Brasília: ${currentHour}:${nowBrasilia.getMinutes().toString().padStart(2, '0')}`);

    if (currentHour < 8 || currentHour >= 19) {
      console.log(`[Horário] Fora do horário comercial (08:00-19:00). Envio bloqueado.`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Fora do horário comercial (08:00-19:00). Hora atual: ${currentHour}:${nowBrasilia.getMinutes().toString().padStart(2, '0')}. Nenhuma mensagem enviada.`,
          sent: 0,
          failed: 0,
          blockedByBusinessHours: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // Collect all payments that match any reminder schedule
    const allPaymentsToNotify: Array<{
      payment: any;
      customerName: string;
      reminderType: string;
    }> = [];

    for (const schedule of REMINDER_SCHEDULE) {
      // Calculate target due date based on schedule
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + schedule.days);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      console.log(`\n--- Checking ${schedule.label} (${schedule.type}) - target due date: ${targetDateStr} ---`);

      // Determine which statuses to fetch
      let statusFilter: string;
      if (schedule.days > 0) {
        // After due date - look for OVERDUE payments
        statusFilter = 'OVERDUE';
      } else if (schedule.days === 0) {
        // Due today - look for PENDING payments
        statusFilter = 'PENDING';
      } else {
        // Before due date - look for PENDING payments
        statusFilter = 'PENDING';
      }

      // Fetch payments from Asaas with the target due date
      const params = new URLSearchParams();
      params.append('dueDate[ge]', targetDateStr);
      params.append('dueDate[le]', targetDateStr);
      params.append('status', statusFilter);
      params.append('limit', '100');

      const paymentsUrl = `${ASAAS_API_URL}/payments?${params.toString()}`;
      console.log(`[Asaas] Fetching payments: ${paymentsUrl}`);

      const paymentsResponse = await fetch(paymentsUrl, {
        method: 'GET',
        headers: asaasHeaders,
      });

      if (!paymentsResponse.ok) {
        console.error(`[Asaas] Error fetching payments for ${schedule.type}: ${paymentsResponse.status}`);
        continue;
      }

      const paymentsData = await paymentsResponse.json();
      const payments = paymentsData.data || [];
      console.log(`[Asaas] Found ${payments.length} ${statusFilter} payments due on ${targetDateStr}`);

      if (payments.length === 0) continue;

      // Fetch customer names for these payments
      const customerIds = [...new Set(payments.map((p: any) => p.customer))] as string[];
      const customerNames: Record<string, string> = {};
      const customerPhones: Record<string, string> = {};

      await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            const customerRes = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
              method: 'GET',
              headers: asaasHeaders,
            });
            const customerData = await customerRes.json();
            if (customerData.name) {
              customerNames[customerId] = customerData.name;
            }
            // Try to get phone from customer data
            const phone = customerData.mobilePhone || customerData.phone;
            if (phone) {
              customerPhones[customerId] = phone;
            }
          } catch (err) {
            console.error(`[Asaas] Error fetching customer ${customerId}:`, err);
          }
        })
      );

      // Check which payments already had this reminder sent
      const paymentIds = payments.map((p: any) => p.id);
      const { data: existingReminders } = await supabase
        .from('boleto_reminder_log')
        .select('asaas_payment_id')
        .in('asaas_payment_id', paymentIds)
        .eq('reminder_type', schedule.type)
        .eq('status', 'sent');

      const alreadySentIds = new Set((existingReminders || []).map((r: any) => r.asaas_payment_id));

      for (const payment of payments) {
        if (alreadySentIds.has(payment.id)) {
          console.log(`[Skip] Reminder ${schedule.type} already sent for payment ${payment.id}`);
          continue;
        }

        const customerPhone = customerPhones[payment.customer];
        if (!customerPhone) {
          console.log(`[Skip] No phone for customer ${payment.customer} (payment ${payment.id})`);
          continue;
        }

        allPaymentsToNotify.push({
          payment: {
            ...payment,
            customerPhone,
          },
          customerName: customerNames[payment.customer] || payment.customer,
          reminderType: schedule.type,
        });
      }
    }

    console.log(`\n=== Total payments to notify: ${allPaymentsToNotify.length} ===`);

    if (allPaymentsToNotify.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum lembrete de boleto a enviar hoje.',
          sent: 0,
          failed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process in background with 3-minute intervals
    const processReminders = async () => {
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < allPaymentsToNotify.length; i++) {
        const { payment, customerName, reminderType } = allPaymentsToNotify[i];

        try {
          console.log(`[${i + 1}/${allPaymentsToNotify.length}] Sending ${reminderType} reminder to ${customerName} (${payment.customerPhone})`);

          const message = buildReminderMessage(
            customerName,
            payment.value,
            payment.dueDate,
            reminderType,
            payment.invoiceUrl
          );

          const result = await sendZAPIMessage(payment.customerPhone, message);

          // Log success
          await supabase.from('boleto_reminder_log').insert({
            asaas_payment_id: payment.id,
            customer_id: payment.customer,
            customer_name: customerName,
            customer_phone: payment.customerPhone.replace(/\D/g, ''),
            reminder_type: reminderType,
            due_date: payment.dueDate,
            value: payment.value,
            status: 'sent',
            zapi_message_id: result.zaapId || null,
          });

          // Also log in Z-API messages log
          await supabase.from('zapi_messages_log').insert({
            customer_id: payment.customer,
            customer_name: customerName,
            customer_phone: payment.customerPhone.replace(/\D/g, ''),
            message_text: `Lembrete boleto (${reminderType}) - ${customerName} - ${formatCurrency(payment.value)} - Venc: ${payment.dueDate}`,
            message_type: 'lembrete_boleto',
            status: 'sent',
            zapi_message_id: result.zaapId || null,
          });

          // Mirror into WhatsApp Avisos panel
          await saveOutboundToWhatsApp(supabase, {
            phone: payment.customerPhone,
            messageText: message + FOOTER_AVISO,
            zaapId: result.zaapId || null,
            contactName: customerName,
            messageType: 'text',
          });

          sent++;
          console.log(`✓ Reminder ${reminderType} sent to ${customerName}`);

          // Wait 3 minutes between messages (except the last one)
          if (i < allPaymentsToNotify.length - 1) {
            console.log(`⏳ Waiting 3 minutes before next message...`);
            await new Promise(resolve => setTimeout(resolve, BULK_INTERVAL_MS));
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`✗ Failed to send ${reminderType} to ${customerName}:`, errorMsg);

          // Log failure (use upsert to handle unique constraint)
          await supabase.from('boleto_reminder_log').insert({
            asaas_payment_id: payment.id,
            customer_id: payment.customer,
            customer_name: customerName,
            customer_phone: payment.customerPhone?.replace(/\D/g, '') || '',
            reminder_type: reminderType,
            due_date: payment.dueDate,
            value: payment.value,
            status: 'failed',
            error_message: errorMsg,
          }).then(({ error: logError }) => {
            if (logError) console.error('Error logging failed reminder:', logError);
          });

          failed++;

          // Still wait between messages even on failure
          if (i < allPaymentsToNotify.length - 1) {
            await new Promise(resolve => setTimeout(resolve, BULK_INTERVAL_MS));
          }
        }
      }

      console.log(`\n=== Boleto Reminders Complete: ${sent} sent, ${failed} failed ===`);
    };

    // Start background processing
    (globalThis as any).EdgeRuntime?.waitUntil(processReminders());

    return new Response(
      JSON.stringify({
        success: true,
        message: `Envio de ${allPaymentsToNotify.length} lembretes de boleto iniciado. As mensagens serão enviadas com intervalo de 3 minutos entre cada uma.`,
        totalReminders: allPaymentsToNotify.length,
        estimatedTimeMinutes: (allPaymentsToNotify.length - 1) * 3,
        breakdown: REMINDER_SCHEDULE.map(s => ({
          type: s.type,
          label: s.label,
          count: allPaymentsToNotify.filter(p => p.reminderType === s.type).length,
        })).filter(b => b.count > 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Boleto Reminders] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

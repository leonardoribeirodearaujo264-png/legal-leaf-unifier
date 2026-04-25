import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-region',
};

const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_MESSAGES_PER_RUN = 35;

function getSafeErrorMessage(error: Error | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('telefone inválido') || errorMessage.includes('formato')) return 'Número de telefone inválido';
  if (errorMessage.includes('API') || errorMessage.includes('comunicação')) return 'Erro ao enviar mensagem';
  if (errorMessage.includes('credentials') || errorMessage.includes('Credenciais')) return 'Sistema de mensagens não configurado';
  return 'Erro ao processar solicitação';
}

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) fullPhone = `55${cleanPhone}`;
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) throw new Error('Número de telefone com formato inválido');
  return fullPhone;
}

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

// ===== Z-API send function =====
async function sendBirthdayViaZapi(phone: string, customerName: string, messageTemplate: string): Promise<{ success: boolean; message: string; zaapId: string | null }> {
  const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')?.trim();
  const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')?.trim();
  const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN')?.trim();

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) throw new Error('Credenciais Z-API não configuradas');

  const fullPhone = validateBrazilianPhone(phone);
  const firstName = customerName.split(' ')[0];

  const message = messageTemplate
    .split('{nome}').join(customerName)
    .split('{primeiro_nome}').join(firstName);

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: fullPhone, message }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[Z-API] Send failed:', data);
    throw new Error('Falha ao enviar via Z-API');
  }

  const zaapId = data?.zaapId || data?.messageId || null;
  return { success: true, message, zaapId };
}

// ===== Save message to WhatsApp Avisos =====
async function saveToWhatsAppAvisos(
  supabase: any,
  phone: string,
  messageText: string,
  zaapId: string | null,
  userId: string | null,
  customerName: string
) {
  try {
    const cleanPhone = validateBrazilianPhone(phone);
    const preview = messageText.substring(0, 100);

    // Upsert conversation
    const { data: existingConv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      await supabase.from('whatsapp_conversations').update({
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
        contact_name: customerName || undefined,
      }).eq('id', conversationId);
    } else {
      const { data: newConv } = await supabase.from('whatsapp_conversations').insert({
        phone: cleanPhone,
        contact_name: customerName || null,
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      }).select('id').single();
      conversationId = newConv?.id;
    }

    if (!conversationId) {
      console.error(`[Birthday] No conversation ID for phone ${cleanPhone}`);
      return;
    }

    // Insert message
    const { error: msgError } = await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      phone: cleanPhone,
      direction: 'outbound',
      message_type: 'text',
      content: messageText,
      zapi_message_id: zaapId,
      status: 'sent',
      sent_by: userId,
      is_from_me: true,
    });

    if (msgError) {
      console.error(`[Birthday] Error saving message: ${JSON.stringify(msgError)}`);
    } else {
      console.log(`[Birthday] ✓ Message saved to WhatsApp Avisos for ${cleanPhone}`);
    }
  } catch (err) {
    console.error(`[Birthday] saveToWhatsAppAvisos error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function getBrazilDate(): { day: number; month: number; todayStart: string } {
  const now = new Date();
  const brazilOffset = -3 * 60;
  const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
  const day = brazilTime.getDate();
  const month = brazilTime.getMonth() + 1;
  const todayStart = new Date(brazilTime.getFullYear(), brazilTime.getMonth(), brazilTime.getDate()).toISOString();
  return { day, month, todayStart };
}

interface CustomerInput {
  id: string;
  name: string;
  phone?: string;
  birthday: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso restrito - apenas administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate Z-API credentials
    if (!Deno.env.get('ZAPI_INSTANCE_ID') || !Deno.env.get('ZAPI_TOKEN')) {
      throw new Error('Credenciais Z-API não configuradas');
    }

    // Fetch automation rule for birthday
    const { data: automationRule } = await supabase
      .from('whatsapp_automation_rules')
      .select('*')
      .eq('type', 'birthday')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const intervalMs = (automationRule?.interval_seconds || 120) * 1000;
    const messageTemplate = automationRule?.message_template || '';

    console.log(`Birthday automation: send_via=zapi, interval=${intervalMs}ms`);

    // Parse request body
    let bodyCustomers: CustomerInput[] = [];
    let forceResend = false;
    try {
      const body = await req.json();
      bodyCustomers = body?.customers || [];
      forceResend = body?.forceResend === true;
    } catch {
      // Empty body is ok
    }

    const { day: currentDay, month: currentMonth, todayStart } = getBrazilDate();
    console.log(`Birthday check: day=${currentDay}, month=${currentMonth}, received ${bodyCustomers.length} customers, forceResend=${forceResend}`);

    if (bodyCustomers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum aniversariante enviado pelo frontend', results: { total: 0, sent: 0, failed: 0, remaining: 0, alreadySentToday: 0, errors: [] } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Server-side validation
    const todayBirthdays = bodyCustomers.filter(c => {
      if (!c.phone || !c.birthday) return false;
      try {
        const d = new Date(c.birthday);
        return d.getDate() === currentDay && (d.getMonth() + 1) === currentMonth;
      } catch {
        return false;
      }
    });

    // Fetch exclusions
    const { data: exclusions } = await supabase.from('customer_birthday_exclusions').select('customer_id');
    const excludedIds = new Set((exclusions || []).map((e: any) => e.customer_id));

    // Idempotency check
    let alreadySentIds = new Set<string>();
    let alreadySentToday = 0;

    if (forceResend) {
      const { data: updateData, error: updateError } = await supabase
        .from('birthday_messages_log')
        .update({ status: 'resent', error_message: 'Reenvio forçado pelo administrador' })
        .eq('status', 'sent')
        .gte('created_at', todayStart)
        .select('id');
      
      const updatedCount = updateData?.length || 0;
      console.log(`Force resend: marked ${updatedCount} previous entries as "resent"${updateError ? `, error: ${updateError.message}` : ''}`);
    } else {
      const { data: alreadySentData } = await supabase
        .from('birthday_messages_log')
        .select('customer_id')
        .eq('status', 'sent')
        .eq('send_via', 'zapi')
        .gte('created_at', todayStart);

      alreadySentIds = new Set((alreadySentData || []).map((e: any) => e.customer_id));
      alreadySentToday = alreadySentIds.size;
    }

    const customersToMessage = todayBirthdays
      .filter(c => !excludedIds.has(c.id) && !alreadySentIds.has(c.id))
      .slice(0, MAX_MESSAGES_PER_RUN);

    const totalEligible = todayBirthdays.filter(c => !excludedIds.has(c.id) && !alreadySentIds.has(c.id)).length;

    console.log(`${customersToMessage.length} to send (${totalEligible} eligible, ${alreadySentToday} already sent) via zapi`);

    // Helper to process a single customer send + save
    async function processCustomerSend(customer: CustomerInput, index: number, total: number) {
      try {
        console.log(`[${index + 1}/${total}] Sending to ${customer.name} via Z-API`);
        const result = await sendBirthdayViaZapi(customer.phone!, customer.name, messageTemplate);

        // Log to birthday messages table
        await supabase.from('birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Mensagem de aniversário enviada via Z-API para ${customer.name}`,
          status: 'sent',
          send_via: 'zapi',
        });

        // Save to WhatsApp Avisos so it appears in the chat interface
        await saveToWhatsAppAvisos(supabase, customer.phone!, result.message, result.zaapId, user?.id ?? null, customer.name);

        return { success: true };
      } catch (error: unknown) {
        const safeError = getSafeErrorMessage(error);
        console.error(`✗ Failed for ${customer.name}:`, error instanceof Error ? error.message : String(error));

        await supabase.from('birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!,
          message_text: `Falha no envio via Z-API para ${customer.name}`,
          status: 'failed',
          error_message: safeError,
          send_via: 'zapi',
        });

        return { success: false, error: safeError };
      }
    }

    // For long intervals, use background processing
    if (customersToMessage.length > 0 && intervalMs >= 60000) {
      const bgResults = {
        total: customersToMessage.length,
        sent: 0,
        failed: 0,
        remaining: Math.max(0, totalEligible - customersToMessage.length),
        alreadySentToday,
        errors: [] as { customer: string; error: string }[],
      };

      const bgPromise = (async () => {
        for (let i = 0; i < customersToMessage.length; i++) {
          const result = await processCustomerSend(customersToMessage[i], i, customersToMessage.length);
          if (result.success) {
            bgResults.sent++;
          } else {
            bgResults.failed++;
            bgResults.errors.push({ customer: customersToMessage[i].name, error: result.error! });
          }

          if (i < customersToMessage.length - 1) {
            console.log(`⏳ Waiting ${intervalMs / 1000}s before next message...`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
        console.log('Background birthday sending completed:', bgResults);
      })();

      try {
        (globalThis as any).EdgeRuntime?.waitUntil(bgPromise);
      } catch {
        bgPromise.catch(e => console.error('Background send error:', e));
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Envio iniciado em background via Z-API. ${customersToMessage.length} mensagem(ns) serão enviadas com intervalo de ${intervalMs / 1000}s.`,
          results: {
            total: customersToMessage.length,
            sent: 0,
            failed: 0,
            remaining: bgResults.remaining,
            alreadySentToday,
            errors: [],
            backgroundProcessing: true,
            forceResend,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Synchronous processing (short intervals)
    const MAX_EXECUTION_MS = 120_000;
    const startTime = Date.now();
    const results = {
      total: customersToMessage.length,
      sent: 0,
      failed: 0,
      remaining: Math.max(0, totalEligible - customersToMessage.length),
      alreadySentToday,
      errors: [] as { customer: string; error: string }[],
    };

    for (let i = 0; i < customersToMessage.length; i++) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        results.remaining += customersToMessage.length - i;
        console.log(`⏳ Time guardrail at ${i}/${customersToMessage.length}.`);
        break;
      }

      const result = await processCustomerSend(customersToMessage[i], i, customersToMessage.length);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ customer: customersToMessage[i].name, error: result.error! });
      }

      if (i < customersToMessage.length - 1 && Date.now() - startTime < MAX_EXECUTION_MS) {
        await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, 2000)));
      }
    }

    console.log('Birthday automation completed:', results);

    return new Response(
      JSON.stringify({ success: true, message: 'Automação de mensagens de aniversário concluída', results: { ...results, forceResend } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in birthday messages automation:', error);
    return new Response(
      JSON.stringify({ success: false, error: getSafeErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

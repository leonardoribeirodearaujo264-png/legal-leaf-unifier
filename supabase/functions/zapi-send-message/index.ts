import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHATSAPP_OFICIAL = '553132268742';
const FOOTER_AVISO = `\n\n⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*\nPara entrar em contato conosco, utilize nosso canal oficial:\n📞 WhatsApp Oficial: https://wa.me/${WHATSAPP_OFICIAL}\n\n_Não responda esta mensagem._`;

const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

function getZAPICredentials() {
  const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
  const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
  const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    throw new Error('Credenciais da Z-API não configuradas');
  }
  return { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN };
}

function getBaseUrl() {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN } = getZAPICredentials();
  return `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
}

function getHeaders() {
  const { ZAPI_CLIENT_TOKEN } = getZAPICredentials();
  return { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN };
}

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) fullPhone = `55${cleanPhone}`;
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: ${phone}`);
  }
  return fullPhone;
}

async function callZAPI(endpoint: string, body: Record<string, any>): Promise<any> {
  const url = `${getBaseUrl()}${endpoint}`;
  console.log(`[Z-API] Calling ${endpoint}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  console.log(`[Z-API] Response: ${response.status} - ${responseText.substring(0, 200)}`);
  if (!response.ok) throw new Error(`Z-API error (${response.status}): ${responseText}`);
  try { return JSON.parse(responseText); } catch { return { raw: responseText }; }
}

async function saveMessageAndUpdateConversation(
  supabase: any, phone: string, messageType: string, content: string | null,
  mediaUrl: string | null, mediaMimeType: string | null, mediaFilename: string | null,
  zapiResult: any, userId: string, appendFooter: boolean
) {
  try {
    const cleanPhone = validateBrazilianPhone(phone);
    const zapiMessageId = zapiResult?.zaapId || zapiResult?.messageId || null;

    console.log(`[Z-API] saveMessage: phone=${cleanPhone}, type=${messageType}, zapiId=${zapiMessageId}`);

    // Upsert conversation
    const { data: existingConv, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (convError) {
      console.error(`[Z-API] Error finding conversation: ${JSON.stringify(convError)}`);
    }

    let conversationId: string;
    const preview = content?.substring(0, 100) || `[${messageType}]`;

    if (existingConv) {
      conversationId = existingConv.id;
      const { error: updateError } = await supabase.from('whatsapp_conversations').update({
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
      }).eq('id', conversationId);
      if (updateError) {
        console.error(`[Z-API] Error updating conversation: ${JSON.stringify(updateError)}`);
      }
    } else {
      const { data: newConv, error: insertConvError } = await supabase.from('whatsapp_conversations').insert({
        phone: cleanPhone,
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      }).select('id').single();
      if (insertConvError) {
        console.error(`[Z-API] Error creating conversation: ${JSON.stringify(insertConvError)}`);
      }
      conversationId = newConv?.id;
    }

    if (!conversationId) {
      console.error(`[Z-API] No conversation ID found for phone ${cleanPhone}`);
      return;
    }

    console.log(`[Z-API] Inserting message into conversation ${conversationId}`);

    const { error: msgError } = await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      phone: cleanPhone,
      direction: 'outbound',
      message_type: messageType,
      content: content,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      media_filename: mediaFilename,
      zapi_message_id: zapiMessageId,
      status: 'sent',
      sent_by: userId,
      is_from_me: true,
    });

    if (msgError) {
      console.error(`[Z-API] Error inserting message: ${JSON.stringify(msgError)}`);
    } else {
      console.log(`[Z-API] ✓ Message saved to whatsapp_messages for ${cleanPhone}`);
    }
  } catch (err) {
    console.error(`[Z-API] saveMessage exception: ${err instanceof Error ? err.message : String(err)}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    const body = await req.json();
    const { action } = body;

    // === SETUP WEBHOOKS ===
    if (action === 'setup-webhooks') {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
      const ZAPI_WEBHOOK_SECRET = Deno.env.get('ZAPI_WEBHOOK_SECRET') ?? '';
      if (!ZAPI_WEBHOOK_SECRET) {
        return new Response(JSON.stringify({
          success: false,
          error: 'ZAPI_WEBHOOK_SECRET não configurado. Cadastre o secret antes de registrar os webhooks.',
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Z-API não suporta header customizado — passamos o secret via query param.
      // O zapi-webhook valida tanto query (?secret=) quanto header X-Webhook-Secret.
      const webhookUrl = `${SUPABASE_URL}/functions/v1/zapi-webhook?secret=${encodeURIComponent(ZAPI_WEBHOOK_SECRET)}`;
      console.log(`[Z-API] Setting up webhooks pointing to: ${SUPABASE_URL}/functions/v1/zapi-webhook (secret via query)`);

      // ReceivedCallback já vai com notifySentByMe: true para incluir mensagens
      // disparadas pela própria instância (ex.: ZapSign, lembretes Asaas, envios manuais).
      // Sem isso só chegariam mensagens recebidas de clientes.
      const webhookConfigs = [
        { endpoint: '/update-webhook-received', body: { value: webhookUrl, notifySentByMe: true }, name: 'ReceivedCallback' },
        { endpoint: '/update-webhook-delivery', body: { value: webhookUrl }, name: 'DeliveryCallback' },
        { endpoint: '/update-webhook-message-status', body: { value: webhookUrl }, name: 'MessageStatusCallback' },
        { endpoint: '/update-webhook-chat-presence', body: { value: webhookUrl }, name: 'ChatPresenceCallback' },
        { endpoint: '/update-webhook-disconnected', body: { value: webhookUrl }, name: 'DisconnectedCallback' },
        { endpoint: '/update-webhook-connected', body: { value: webhookUrl }, name: 'ConnectedCallback' },
      ];

      const results: { name: string; success: boolean; status?: number; error?: string }[] = [];
      for (const config of webhookConfigs) {
        try {
          const resp = await fetch(`${getBaseUrl()}${config.endpoint}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(config.body),
          });
          const respText = await resp.text();
          if (resp.ok) {
            console.log(`[Z-API] ✓ ${config.name} registered (HTTP ${resp.status})`);
            results.push({ name: config.name, success: true, status: resp.status });
          } else {
            console.error(`[Z-API] ✗ ${config.name} failed (HTTP ${resp.status}): ${respText}`);
            results.push({ name: config.name, success: false, status: resp.status, error: respText });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Z-API] ✗ ${config.name} threw exception:`, errMsg);
          results.push({ name: config.name, success: false, error: errMsg });
        }
      }

      const failed = results.filter(r => !r.success);
      const allOk = failed.length === 0;
      return new Response(JSON.stringify({
        success: allOk,
        message: allOk
          ? `${results.length}/${results.length} webhooks configurados com sucesso.`
          : `${results.length - failed.length}/${results.length} configurados. Falharam: ${failed.map(f => f.name).join(', ')}`,
        webhookUrl: `${SUPABASE_URL}/functions/v1/zapi-webhook`,
        results,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === TEST CONNECTION ===
    if (action === 'test-connection') {
      const statusUrl = `${getBaseUrl()}/status`;
      const statusResponse = await fetch(statusUrl, { headers: getHeaders() });
      const statusData = await statusResponse.json();
      return new Response(JSON.stringify({
        success: statusResponse.ok, status: statusData,
        connected: statusData?.connected || statusData?.smartphoneConnected || false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === SEND TEXT MESSAGE ===
    if (action === 'send-message') {
      const { phone, message, skipFooter } = body;
      if (!phone || !message) {
        return new Response(JSON.stringify({ error: 'phone e message são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const fullPhone = validateBrazilianPhone(phone);
      const fullMessage = skipFooter ? message : message + FOOTER_AVISO;
      const result = await callZAPI('/send-text', { phone: fullPhone, message: fullMessage });
      await saveMessageAndUpdateConversation(supabase, phone, 'text', message, null, null, null, result, user.id, !skipFooter);
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === SEND AUDIO ===
    if (action === 'send-audio') {
      const { phone, audioUrl } = body;
      if (!phone || !audioUrl) {
        return new Response(JSON.stringify({ error: 'phone e audioUrl são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const fullPhone = validateBrazilianPhone(phone);
      const result = await callZAPI('/send-audio', { phone: fullPhone, audio: audioUrl });
      await saveMessageAndUpdateConversation(supabase, phone, 'audio', null, audioUrl, 'audio/ogg', null, result, user.id, false);
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === SEND IMAGE ===
    if (action === 'send-image') {
      const { phone, imageUrl, caption } = body;
      if (!phone || !imageUrl) {
        return new Response(JSON.stringify({ error: 'phone e imageUrl são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const fullPhone = validateBrazilianPhone(phone);
      const result = await callZAPI('/send-image', { phone: fullPhone, image: imageUrl, caption: caption || '' });
      await saveMessageAndUpdateConversation(supabase, phone, 'image', caption || null, imageUrl, 'image/jpeg', null, result, user.id, false);
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === SEND DOCUMENT ===
    if (action === 'send-document') {
      const { phone, documentUrl, filename } = body;
      if (!phone || !documentUrl) {
        return new Response(JSON.stringify({ error: 'phone e documentUrl são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const fullPhone = validateBrazilianPhone(phone);
      const ext = filename?.split('.').pop() || 'pdf';
      const result = await callZAPI(`/send-document/${ext}`, {
        phone: fullPhone, document: documentUrl, fileName: filename || 'documento',
      });
      await saveMessageAndUpdateConversation(supabase, phone, 'document', filename || null, documentUrl, null, filename, result, user.id, false);
      return new Response(JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === SEND BULK ===
    if (action === 'send-bulk') {
      const { messages: messagesList } = body;
      if (!Array.isArray(messagesList) || messagesList.length === 0) {
        return new Response(JSON.stringify({ error: 'messages deve ser um array não vazio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const INTERVAL_MS = 3 * 60 * 1000;
      const processBulk = async () => {
        for (let i = 0; i < messagesList.length; i++) {
          const msg = messagesList[i];
          try {
            const fullPhone = validateBrazilianPhone(msg.phone);
            const fullMessage = msg.message + FOOTER_AVISO;
            const result = await callZAPI('/send-text', { phone: fullPhone, message: fullMessage });
            await supabase.from('zapi_messages_log').insert({
              customer_id: msg.customerId || null, customer_name: msg.customerName || null,
              customer_phone: msg.phone.replace(/\D/g, ''), message_text: msg.message,
              message_type: msg.type || 'aviso', status: 'sent',
              zapi_message_id: result.zaapId || result.messageId || null,
              sent_at: new Date().toISOString(), sent_by: user.id,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await supabase.from('zapi_messages_log').insert({
              customer_id: msg.customerId || null, customer_name: msg.customerName || null,
              customer_phone: msg.phone.replace(/\D/g, ''), message_text: msg.message,
              message_type: msg.type || 'aviso', status: 'failed', error_message: errorMsg, sent_by: user.id,
            });
          }
          if (i < messagesList.length - 1) await new Promise(r => setTimeout(r, INTERVAL_MS));
        }
      };

      (globalThis as any).EdgeRuntime?.waitUntil(processBulk());
      return new Response(JSON.stringify({
        success: true,
        message: `Envio de ${messagesList.length} mensagens iniciado com intervalo de 3 minutos.`,
        totalMessages: messagesList.length,
        estimatedTimeMinutes: (messagesList.length - 1) * 3,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === MARK CONVERSATION READ ===
    if (action === 'mark-read') {
      const { conversationId } = body;
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'conversationId é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conversationId);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida. Use: test-connection, send-message, send-audio, send-image, send-document, send-bulk, setup-webhooks, mark-read' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Z-API] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

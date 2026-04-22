import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Check if payload contains actual message content (text, media, etc.)
function hasMessageContent(payload: any): boolean {
  return !!(
    payload.body ||
    payload.text?.message ||
    (typeof payload.text === 'string' && payload.text) ||
    payload.caption ||
    payload.image ||
    payload.audio ||
    payload.video ||
    payload.document ||
    payload.sticker ||
    payload.contact ||
    payload.location || payload.loc ||
    payload.listMessage ||
    payload.buttonsMessage || payload.templateButtons ||
    payload.productMessage ||
    payload.orderMessage ||
    payload.poll ||
    payload.reactionMessage || payload.reaction ||
    payload.linkPreview
  );
}

function extractEventType(payload: any): string {
  const type = payload.type || '';

  // Pure system callbacks that NEVER carry message content
  const pureSystemCallbacks = ['ConnectedCallback', 'DisconnectedCallback', 'BatteryLevelCallback', 'PresenceChatCallback'];
  if (pureSystemCallbacks.includes(type)) {
    if (type === 'ConnectedCallback') return 'connection';
    if (type === 'DisconnectedCallback') return 'disconnection';
    if (type === 'BatteryLevelCallback') return 'battery_level';
    if (type === 'PresenceChatCallback') return 'chat_presence';
    return 'system_callback';
  }

  // Status-only callbacks
  if (type === 'DeliveryCallback' || type === 'MessageStatusCallback') {
    return 'message_status';
  }

  // ReceivedCallback: this is the main event type for BOTH real messages AND some system notifications
  if (type === 'ReceivedCallback') {
    // System notification (no message content)
    if (payload.notification && !hasMessageContent(payload)) return 'system_notification';
    // If it has actual message content, it's a real message
    if (hasMessageContent(payload)) {
      return payload.fromMe === true ? 'sent_message' : 'received_message';
    }
    // No content — treat as status update
    return 'message_status';
  }

  // Fallback detection for payloads without a type field
  if (payload.connected !== undefined && payload.smartphoneConnected !== undefined) {
    return payload.connected ? 'connection' : 'disconnection';
  }
  if (payload.batteryLevel !== undefined) return 'battery_level';
  if (payload.chatPresence || payload.status === 'composing' || payload.status === 'recording' || payload.status === 'available' || payload.status === 'unavailable') {
    return 'chat_presence';
  }
  if (payload.status && payload.id && !hasMessageContent(payload)) {
    return 'message_status';
  }
  if (hasMessageContent(payload) || payload.isStatusReply !== undefined || payload.senderLid || payload.chatLid) {
    return payload.fromMe === true ? 'sent_message' : 'received_message';
  }
  if (payload.reactionMessage || payload.reaction) return 'reaction';
  return 'unknown';
}

function extractMessageType(payload: any): string | null {
  if (!hasMessageContent(payload) && !payload.type) return null;
  // Never return callback type names as message types — extract actual content type
  if (payload.image) return 'image';
  if (payload.audio) return 'audio';
  if (payload.video) return 'video';
  if (payload.document) return 'document';
  if (payload.sticker) return 'sticker';
  if (payload.contact) return 'contact';
  if (payload.location || payload.loc) return 'location';
  if (payload.listMessage) return 'list';
  if (payload.buttonsMessage || payload.templateButtons) return 'buttons';
  if (payload.productMessage) return 'product';
  if (payload.orderMessage) return 'order';
  if (payload.poll) return 'poll';
  if (payload.reactionMessage || payload.reaction) return 'reaction';
  if (payload.linkPreview || payload.matchedText) return 'link_preview';
  if (payload.body || payload.text?.message || (typeof payload.text === 'string' && payload.text) || payload.caption) return 'text';
  // Don't return callback names like 'ReceivedCallback' as message type
  const callbackNames = ['ReceivedCallback', 'DeliveryCallback', 'MessageStatusCallback', 'PresenceChatCallback'];
  if (payload.type && !callbackNames.includes(payload.type)) return payload.type;
  return 'unknown';
}

function extractPhone(payload: any): string | null {
  return payload.phone
    || payload.from
    || payload.chatId?.replace('@c.us', '').replace('@g.us', '')
    || payload.chat?.replace('@c.us', '').replace('@g.us', '')
    || null;
}

function extractMessageText(payload: any): string | null {
  return payload.body
    || payload.text?.message
    || (typeof payload.text === 'string' ? payload.text : null)
    || payload.caption
    || payload.listMessage?.description
    || null;
}

function extractMediaUrl(payload: any): string | null {
  return payload.image?.imageUrl || payload.image?.url
    || payload.audio?.audioUrl || payload.audio?.url
    || payload.video?.videoUrl || payload.video?.url
    || payload.document?.documentUrl || payload.document?.url
    || payload.sticker?.stickerUrl || payload.sticker?.url
    || null;
}

function extractMediaMimeType(payload: any): string | null {
  return payload.image?.mimetype || payload.audio?.mimetype
    || payload.video?.mimetype || payload.document?.mimetype
    || payload.sticker?.mimetype || null;
}

function extractMediaFilename(payload: any): string | null {
  return payload.document?.fileName || payload.document?.filename || null;
}

// Sync message to whatsapp_messages and whatsapp_conversations
async function syncToWhatsApp(supabase: any, eventType: string, payload: any) {
  if (eventType !== 'received_message' && eventType !== 'sent_message') {
    // For message_status events, update existing message status
    if (eventType === 'message_status' && payload.id) {
      const messageId = payload.id?._serialized || payload.id?.id || payload.id;
      const status = payload.status;
      if (messageId && status) {
        const statusMap: Record<string, string> = {
          'SENT': 'sent', 'DELIVERY_ACK': 'delivered', 'READ': 'read', 'PLAYED': 'read',
          'sent': 'sent', 'delivered': 'delivered', 'read': 'read',
        };
        const mappedStatus = statusMap[status] || status;
        await supabase.from('whatsapp_messages')
          .update({ status: mappedStatus })
          .eq('zapi_message_id', messageId);
      }
    }
    return;
  }

  const phone = extractPhone(payload);
  if (!phone) return;

  // Skip group messages
  const isGroup = payload.isGroup || payload.isGroupMsg || phone.includes('@g.us');
  if (isGroup) return;

  const messageText = extractMessageText(payload);
  const mediaUrl = extractMediaUrl(payload);
  const mediaMimeType = extractMediaMimeType(payload);
  const mediaFilename = extractMediaFilename(payload);
  const messageType = extractMessageType(payload) || 'text';
  const isFromMe = payload.fromMe === true;
  const direction = isFromMe ? 'outbound' : 'inbound';

  // Don't save messages that have no content and no media - these are likely system events
  if (!messageText && !mediaUrl) {
    console.log(`[Z-API Webhook] Skipping ${direction} message for ${phone}: no content or media`);
    return;
  }
  const contactName = payload.senderName || payload.pushName || payload.notifyName || payload.chatName || null;
  const zapiMessageId = payload.messageId || payload.id?._serialized || payload.id?.id || null;

  // Map message type to simplified types
  const simplifiedType = ['image', 'audio', 'video', 'document'].includes(messageType) ? messageType : 'text';

  try {
    // Upsert conversation
    const { data: existingConv } = await supabase
      .from('whatsapp_conversations')
      .select('id, unread_count, contact_name')
      .eq('phone', phone)
      .maybeSingle();

    let conversationId: string;
    const preview = messageText?.substring(0, 100) || (simplifiedType !== 'text' ? `[${simplifiedType}]` : '');

    if (existingConv) {
      conversationId = existingConv.id;
      const updateData: Record<string, any> = {
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
      };
      if (!isFromMe) {
        updateData.unread_count = (existingConv.unread_count || 0) + 1;
      }
      if (contactName && !existingConv.contact_name) {
        updateData.contact_name = contactName;
      }
      await supabase.from('whatsapp_conversations').update(updateData).eq('id', conversationId);
    } else {
      const { data: newConv } = await supabase.from('whatsapp_conversations').insert({
        phone,
        contact_name: contactName,
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
        unread_count: isFromMe ? 0 : 1,
      }).select('id').single();
      conversationId = newConv?.id;
    }

    if (!conversationId) return;

    // Check for duplicate message
    if (zapiMessageId) {
      const { data: existing } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('zapi_message_id', zapiMessageId)
        .maybeSingle();
      if (existing) return;
    }

    // Insert message
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      phone,
      direction,
      message_type: simplifiedType,
      content: typeof messageText === 'string' ? messageText : (messageText ? JSON.stringify(messageText) : null),
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      media_filename: mediaFilename,
      zapi_message_id: zapiMessageId,
      status: isFromMe ? 'sent' : 'received',
      is_from_me: isFromMe,
    });

    console.log(`[Z-API Webhook] ✓ Synced ${direction} message to whatsapp_messages for ${phone}`);
  } catch (err) {
    console.error('[Z-API Webhook] Error syncing to whatsapp tables:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Webhook secret validation — fail-closed. Antes era opcional: se a env
    // var não estivesse setada, o bloco inteiro era pulado e qualquer POST
    // passava. Agora, sem segredo cadastrado, recusamos tudo com 500 pra
    // não aceitar payload do mundo inteiro poluindo whatsapp_* tables.
    const ZAPI_WEBHOOK_SECRET = Deno.env.get('ZAPI_WEBHOOK_SECRET');
    if (!ZAPI_WEBHOOK_SECRET) {
      console.error('[Z-API Webhook] ZAPI_WEBHOOK_SECRET não configurado — rejeitando');
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Z-API não suporta header customizado no webhook, então aceitamos o
    // secret também via query param (?secret=...). O header continua sendo
    // aceito como fallback para compatibilidade com testes manuais.
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret');
    const headerSecret = req.headers.get('X-Webhook-Secret') ||
                         req.headers.get('x-webhook-secret');
    const authToken = querySecret || headerSecret;
    if (authToken !== ZAPI_WEBHOOK_SECRET) {
      console.error('[Z-API Webhook] Unauthorized: invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    const eventType = extractEventType(payload);
    const messageType = extractMessageType(payload);
    const phone = extractPhone(payload);
    const messageText = extractMessageText(payload);
    const mediaUrl = extractMediaUrl(payload);
    const mediaMimeType = extractMediaMimeType(payload);

    console.log(`[Z-API Webhook] Event: ${eventType} | Type: ${messageType} | Phone: ${phone} | FromMe: ${payload.fromMe || false}`);

    const eventRecord: Record<string, unknown> = {
      event_type: eventType,
      phone: phone,
      message_id: payload.messageId || payload.id?.id || payload.id?._serialized || null,
      zaap_id: payload.zapiMessageId || payload.zaapId || null,
      is_group: payload.isGroup || payload.isGroupMsg || (phone?.includes('@g.us') ?? false),
      chat_name: payload.chatName || payload.chat?.name || payload.senderName || null,
      sender_name: payload.senderName || payload.pushName || payload.notifyName || null,
      sender_phone: payload.senderPhone || payload.sender || payload.participant || null,
      is_from_me: payload.fromMe || false,
      moment_type: payload.momment || payload.moment || null,
      status: payload.status || null,
      broadcast: payload.broadcast || false,
      message_type: messageType,
      message_text: typeof messageText === 'string' ? messageText : (messageText ? JSON.stringify(messageText) : null),
      caption: payload.caption || null,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      latitude: payload.location?.latitude || payload.loc?.latitude || null,
      longitude: payload.location?.longitude || payload.loc?.longitude || null,
      thumbnail_url: payload.thumbnail || payload.image?.thumbnail || null,
      link_url: payload.matchedText || payload.linkPreview?.canonicalUrl || null,
      link_title: payload.linkPreview?.title || null,
      link_description: payload.linkPreview?.description || null,
      quoted_message_id: payload.quotedMsg?.id || payload.quotedMsgId || null,
      reaction_emoji: payload.reactionMessage?.text || payload.reaction?.text || null,
      connected: payload.connected ?? null,
      battery_level: payload.batteryLevel ?? null,
      is_charging: payload.isCharging ?? null,
      raw_payload: payload,
      received_at: new Date().toISOString(),
    };

    // Save to audit table
    const { error: insertError } = await supabase
      .from('zapi_webhook_events')
      .insert(eventRecord);

    if (insertError) {
      console.error('[Z-API Webhook] Error inserting event:', insertError);
    } else {
      console.log(`[Z-API Webhook] ✓ Event saved: ${eventType} from ${phone || 'system'}`);
    }

    // Sync to whatsapp_messages and whatsapp_conversations
    await syncToWhatsApp(supabase, eventType, payload);

    return new Response(
      JSON.stringify({ success: true, eventType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Z-API Webhook] Error processing webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

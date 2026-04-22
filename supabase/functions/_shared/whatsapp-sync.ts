// Shared helper to record outbound WhatsApp messages into the
// whatsapp_conversations / whatsapp_messages tables that power
// the /whatsapp-avisos panel.
//
// Use this from any edge function that sends a Z-API message directly
// (ZapSign, Asaas reminders, defaulter collections, CRM automations, etc.).
//
// Idempotent: relies on the unique-ish zapi_message_id and a maybeSingle
// check so that a later SentCallback / re-run does not duplicate rows.

const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

function normalizeBrazilianPhone(phone: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: ${phone}`);
  }
  return fullPhone;
}

export interface SaveOutboundParams {
  phone: string;
  messageText: string;
  zaapId?: string | null;
  sentBy?: string | null;
  contactName?: string | null;
  messageType?: string;
}

/**
 * Save an outbound WhatsApp message into whatsapp_conversations + whatsapp_messages.
 * Never throws — logs errors via console.error and returns silently so the caller
 * (which has already sent the Z-API message) is not torn down.
 */
export async function saveOutboundToWhatsApp(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: SaveOutboundParams,
): Promise<void> {
  try {
    const cleanPhone = normalizeBrazilianPhone(params.phone);
    const preview = (params.messageText || '').substring(0, 100);
    const nowIso = new Date().toISOString();

    // Skip duplicate if a message with the same zapi_message_id already exists
    if (params.zaapId) {
      const { data: existingMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('zapi_message_id', params.zaapId)
        .maybeSingle();
      if (existingMsg) {
        console.log(`[whatsapp-sync] Message ${params.zaapId} already exists, skipping`);
        return;
      }
    }

    // Upsert conversation
    const { data: existingConv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    let conversationId: string | undefined = existingConv?.id;

    if (existingConv) {
      const updatePayload: Record<string, unknown> = {
        last_message_text: preview,
        last_message_at: nowIso,
      };
      if (params.contactName) updatePayload.contact_name = params.contactName;
      await supabase
        .from('whatsapp_conversations')
        .update(updatePayload)
        .eq('id', conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          phone: cleanPhone,
          contact_name: params.contactName || null,
          last_message_text: preview,
          last_message_at: nowIso,
          unread_count: 0,
        })
        .select('id')
        .single();

      if (convError) {
        console.error(`[whatsapp-sync] Error creating conversation: ${JSON.stringify(convError)}`);
        return;
      }
      conversationId = newConv?.id;
    }

    if (!conversationId) {
      console.error(`[whatsapp-sync] No conversation ID for phone ${cleanPhone}`);
      return;
    }

    // Insert outbound message
    const { error: msgError } = await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      phone: cleanPhone,
      direction: 'outbound',
      message_type: params.messageType || 'text',
      content: params.messageText,
      zapi_message_id: params.zaapId || null,
      status: 'sent',
      sent_by: params.sentBy || null,
      is_from_me: true,
    });

    if (msgError) {
      console.error(`[whatsapp-sync] Error saving message: ${JSON.stringify(msgError)}`);
    } else {
      console.log(`[whatsapp-sync] ✓ Saved outbound message to ${cleanPhone}`);
    }
  } catch (err) {
    console.error(
      `[whatsapp-sync] Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

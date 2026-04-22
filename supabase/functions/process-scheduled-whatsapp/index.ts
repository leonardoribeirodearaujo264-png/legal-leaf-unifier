import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) fullPhone = `55${cleanPhone}`;
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: ${phone}`);
  }
  return fullPhone;
}

function isBusinessHours(): boolean {
  const now = new Date();
  // Convert to Brasilia time (UTC-3)
  const brasiliaOffset = -3 * 60;
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utcTime + (brasiliaOffset * 60000));
  const hour = brasiliaTime.getHours();
  return hour >= 8 && hour < 19;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Guarda service-role: só pg_cron pode disparar envio de WhatsApp agendado.
  const authHeader = req.headers.get('Authorization');
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (authHeader !== expectedToken) {
    console.error('Tentativa não autorizada em process-scheduled-whatsapp');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!isBusinessHours()) {
      console.log('[Scheduled WhatsApp] Fora do horário comercial (08:00-19:00 Brasília). Pulando.');
      return new Response(JSON.stringify({ success: true, message: 'Fora do horário comercial' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch pending scheduled messages that are due
    const { data: pendingMessages, error } = await supabase
      .from('whatsapp_scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[Scheduled WhatsApp] Error fetching pending messages:', error);
      throw error;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[Scheduled WhatsApp] Nenhuma mensagem agendada pendente.');
      return new Response(JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Scheduled WhatsApp] Processando ${pendingMessages.length} mensagens agendadas`);

    const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
    const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
    const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Credenciais da Z-API não configuradas');
    }

    const baseUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
    const headers = { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN };

    let sent = 0;
    let failed = 0;

    for (const msg of pendingMessages) {
      try {
        const fullPhone = validateBrazilianPhone(msg.phone);
        let endpoint = '/send-text';
        let body: Record<string, any> = { phone: fullPhone, message: msg.content || '' };

        if (msg.message_type === 'audio' && msg.media_url) {
          endpoint = '/send-audio';
          body = { phone: fullPhone, audio: msg.media_url };
        } else if (msg.message_type === 'image' && msg.media_url) {
          endpoint = '/send-image';
          body = { phone: fullPhone, image: msg.media_url, caption: msg.content || '' };
        } else if (msg.message_type === 'document' && msg.media_url) {
          const ext = msg.media_url.split('.').pop() || 'pdf';
          endpoint = `/send-document/${ext}`;
          body = { phone: fullPhone, document: msg.media_url, fileName: msg.content || 'documento' };
        }

        const response = await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });

        if (!response.ok) {
          const respText = await response.text();
          throw new Error(`Z-API error (${response.status}): ${respText}`);
        }

        await supabase.from('whatsapp_scheduled_messages').update({
          status: 'sent', sent_at: new Date().toISOString(),
        }).eq('id', msg.id);

        sent++;
        console.log(`[Scheduled WhatsApp] ✓ Mensagem ${msg.id} enviada para ${msg.phone}`);

        // Wait 3 seconds between messages to avoid rate limiting
        if (sent < pendingMessages.length) {
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Scheduled WhatsApp] ✗ Erro ao enviar ${msg.id}:`, errorMsg);

        await supabase.from('whatsapp_scheduled_messages').update({
          status: 'failed', error_message: errorMsg,
        }).eq('id', msg.id);

        failed++;
      }
    }

    console.log(`[Scheduled WhatsApp] Concluído: ${sent} enviadas, ${failed} falharam`);

    return new Response(JSON.stringify({ success: true, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Scheduled WhatsApp] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

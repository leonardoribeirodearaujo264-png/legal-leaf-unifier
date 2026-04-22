import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map of WhatsApp Business phone numbers → product names (fallback if DB lookup fails)
const PHONE_PRODUCT_MAP: Record<string, string> = {
  '5531993438742': 'Férias Prêmio',
  '553132268742': 'Imposto de Renda',
  '5511998802573': 'Imobiliário',
};

// Validação HMAC do webhook da Meta. O POST da WhatsApp Cloud API vem
// assinado com HMAC SHA-256 usando o App Secret no header
// X-Hub-Signature-256. Sem isso, qualquer um pode POSTar payloads falsos
// e alimentar o CRM com dados inventados.
async function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice('sha256='.length);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Comparação constant-time pra evitar timing attack
  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── GET: Webhook Verification ──
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }

      console.warn('Webhook verification failed — token mismatch');
      return new Response('Forbidden', { status: 200, headers: corsHeaders });
    }

    // ── POST: Incoming messages ──
    if (req.method === 'POST') {
      // Precisamos do body como string crua para calcular o HMAC. Por isso
      // fazemos req.text() e depois JSON.parse em vez de req.json() direto.
      const rawBody = await req.text();

      const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
      if (!appSecret) {
        console.error('WHATSAPP_APP_SECRET não configurado — rejeitando webhook fail-closed');
        return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const signatureHeader = req.headers.get('x-hub-signature-256') || req.headers.get('X-Hub-Signature-256');
      const valid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
      if (!valid) {
        console.error('Assinatura HMAC inválida no webhook do WhatsApp');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = JSON.parse(rawBody);
      console.log('WhatsApp webhook payload:', JSON.stringify(body).slice(0, 500));

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Load phone→product mappings from DB
      let phoneProductMap = { ...PHONE_PRODUCT_MAP };
      try {
        const { data: mappings } = await supabase
          .from('whatsapp_product_numbers')
          .select('phone_number, product_name')
          .eq('is_active', true);
        if (mappings) {
          for (const m of mappings) {
            phoneProductMap[m.phone_number] = m.product_name;
          }
        }
      } catch (e) {
        console.warn('Failed to load phone mappings from DB, using fallback:', e);
      }

      // Process each entry (WhatsApp Cloud API structure)
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const value = change.value || {};

          const messages = value.messages || [];
          const contacts = value.contacts || [];
          const metadata = value.metadata || {};

          // The business phone number that RECEIVED the message
          const businessPhone = metadata.display_phone_number
            ? metadata.display_phone_number.replace(/\D/g, '')
            : null;

          console.log('Business phone (display_phone_number):', businessPhone);

          // Determine product from the business phone number
          const detectedProduct = businessPhone ? (phoneProductMap[businessPhone] || null) : null;
          console.log('Detected product from phone:', detectedProduct);

          // Extract referral from the first message if present (click-to-whatsapp ads)
          const referral = messages[0]?.referral || null;

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const contact = contacts[i] || contacts[0];

            // Process all inbound message types (not just text)
            if (msg.type !== 'text' && msg.type !== 'interactive' && msg.type !== 'button' && msg.type !== 'image' && msg.type !== 'audio' && msg.type !== 'video' && msg.type !== 'document') {
              continue;
            }

            const phone = msg.from; // e.g. "5511999999999"
            const name = contact?.profile?.name || 'WhatsApp Lead';
            const text = msg.text?.body || msg.interactive?.body?.text || msg.button?.text || '';

            console.log(`Processing message from ${phone} (${name}) to business ${businessPhone}: ${text.slice(0, 80)}`);

            // Dedup: check if lead from this phone exists in last 7 days
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const { data: existing } = await supabase
              .from('captured_leads')
              .select('id')
              .eq('whatsapp_phone', phone)
              .gte('created_at', sevenDaysAgo)
              .limit(1);

            if (existing && existing.length > 0) {
              console.log(`Lead already exists for ${phone}, skipping`);
              continue;
            }

            // Build referral-based UTM data
            let utm_source = 'whatsapp';
            let utm_medium: string | null = 'organic';
            let utm_campaign: string | null = null;
            let utm_content: string | null = null;
            let landing_page: string | null = null;

            if (referral) {
              utm_source = referral.source_type === 'ad' ? 'facebook' : 'whatsapp';
              utm_medium = referral.source_type === 'ad' ? 'paid' : 'organic';
              utm_campaign = referral.headline || null;
              utm_content = referral.body || null;
              landing_page = referral.source_url || null;
            }

            // Product: prioritize referral-based detection, then phone-based detection, then URL mapping
            let product_name = detectedProduct;

            if (!product_name && landing_page) {
              const { data: urlMappings } = await supabase
                .from('landing_page_product_mappings')
                .select('url_pattern, product_name');

              if (urlMappings) {
                const match = urlMappings.find((m: any) => {
                  const pattern = m.url_pattern.toLowerCase();
                  const url = landing_page!.toLowerCase();
                  return url.includes(pattern);
                });
                if (match) product_name = match.product_name;
              }
            }

            const { error: insertError } = await supabase
              .from('captured_leads')
              .insert({
                name,
                phone,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_content,
                landing_page,
                product_name,
                whatsapp_phone: phone,
                whatsapp_message: text.slice(0, 1000),
                whatsapp_referral: referral,
                whatsapp_business_phone: businessPhone,
              });

            if (insertError) {
              console.error('Error inserting WhatsApp lead:', insertError);
            } else {
              console.log(`WhatsApp lead saved for ${phone} → product: ${product_name || 'unknown'}, business: ${businessPhone}`);
            }
          }
        }
      }

      // Always return 200 to Meta
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Always return 200 to prevent Meta from retrying
    return new Response(JSON.stringify({ error: 'processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

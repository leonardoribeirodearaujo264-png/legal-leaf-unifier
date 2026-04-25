import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-region, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push helpers --------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const publicKeyBytes = urlBase64ToUint8Array(publicKeyB64);
  const privateKeyBytes = urlBase64ToUint8Array(privateKeyB64);

  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    []
  );

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: btoa(String.fromCharCode(...publicKeyBytes.slice(1, 33)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      y: btoa(String.fromCharCode(...publicKeyBytes.slice(33, 65)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      d: privateKeyB64,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { publicKey, privateKey };
}

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJWT(
  privateKey: CryptoKey,
  aud: string,
  sub: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud, exp: now + 86400, sub, iat: now };

  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(unsigned)
  );

  // Convert DER signature to raw r||s
  const sigBytes = new Uint8Array(sig);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32);
  } else {
    // DER format
    const rLen = sigBytes[3];
    const rStart = 4;
    r = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    s = sigBytes.slice(sStart, sStart + sLen);
    // Pad/trim to 32 bytes
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  return `${unsigned}.${base64urlEncode(rawSig)}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const aud = `${url.protocol}//${url.host}`;

  const jwt = await createJWT(vapidPrivateKey, aud, "mailto:noreply@eggnunes.com.br");

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Type": "application/json",
      TTL: "86400",
    },
    body: payload,
  });
}

// Main handler ------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth obrigatória: previne spoof de remetente e spam de push.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messageId, conversationId, senderId, content } = await req.json();
    if (!messageId || !conversationId || !senderId) {
      return new Response(JSON.stringify({ error: "missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // senderId precisa ser quem está autenticado — senão o usuário
    // consegue se passar por outra pessoa disparando push em nome dela.
    if (senderId !== user.id) {
      return new Response(JSON.stringify({ error: "senderId não confere com usuário autenticado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sender name
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", senderId)
      .single();
    const senderName = senderProfile?.full_name || "Alguém";

    // Get other participants
    const { data: participants } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId);

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = participants.map((p) => p.user_id);

    // Get active subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from("browser_push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", userIds)
      .eq("is_active", true);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKeyB64 = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const { privateKey: vapidPrivateKey } = await importVapidKeys(vapidPublicKey, vapidPrivateKeyB64);

    const truncated = (content || "").length > 100
      ? content.substring(0, 100) + "..."
      : content || "Enviou um anexo";

    const pushPayload = JSON.stringify({
      title: `Nova mensagem de ${senderName}`,
      body: truncated,
      conversationId,
    });

    let sent = 0;
    const expiredIds: string[] = [];

    for (const sub of subscriptions) {
      try {
        const res = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          pushPayload,
          vapidPublicKey,
          vapidPrivateKey
        );
        if (res.ok) {
          sent++;
        } else if (res.status === 410 || res.status === 404) {
          expiredIds.push(sub.id);
        } else {
          console.warn(`Push failed for ${sub.id}: ${res.status}`);
        }
      } catch (err) {
        console.error(`Push error for ${sub.id}:`, err);
      }
    }

    // Deactivate expired subscriptions
    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from("browser_push_subscriptions")
        .update({ is_active: false })
        .in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({ sent, expired: expiredIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-internal-message error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

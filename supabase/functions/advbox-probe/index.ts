import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = Deno.env.get('ADVBOX_API_TOKEN')!;
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') || '/lawsuits?limit=2&offset=0';
  
  const r = await fetch(`https://app.advbox.com.br/api/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  
  const text = await r.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
  
  // Extract first item & all keys
  const items = body?.data || body || [];
  const first = Array.isArray(items) ? items[0] : items;
  const keys = first && typeof first === 'object' ? Object.keys(first) : [];
  
  return new Response(JSON.stringify({
    status: r.status,
    keys,
    first_item: first,
    total: body?.meta?.total ?? body?.total ?? items?.length,
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

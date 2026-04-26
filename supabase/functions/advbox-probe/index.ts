import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = Deno.env.get('ADVBOX_API_TOKEN')!;
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'sample';

  if (action === 'stages') {
    // Pegar todas as 12000 lawsuits e contar por stage
    const stageCounts: Record<string, number> = {};
    const stepCounts: Record<string, number> = {};
    let total = 0;
    let totalReported = 0;

    for (let offset = 0; offset < 12000; offset += 100) {
      const r = await fetch(`https://app.advbox.com.br/api/v1/lawsuits?limit=100&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await r.json();
      const items = body?.data || [];
      if (offset === 0) totalReported = body?.meta?.total ?? body?.total ?? 0;
      if (items.length === 0) break;

      for (const it of items) {
        const s = it.stage ?? '__NULL__';
        stageCounts[s] = (stageCounts[s] || 0) + 1;
        const st = it.step ?? '__NULL__';
        stepCounts[st] = (stepCounts[st] || 0) + 1;
        total++;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ total, totalReported, stageCounts, stepCounts }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Default: sample one
  const endpoint = url.searchParams.get('endpoint') || '/lawsuits?limit=2&offset=0';
  const r = await fetch(`https://app.advbox.com.br/api/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await r.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
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

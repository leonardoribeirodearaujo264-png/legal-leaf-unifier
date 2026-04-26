import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = Deno.env.get('ADVBOX_API_TOKEN')!;
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'sample';

  if (action === 'stages') {
    const start = parseInt(url.searchParams.get('start') || '0', 10);
    const end = parseInt(url.searchParams.get('end') || '12000', 10);
    const stageCounts: Record<string, number> = {};
    const stepCounts: Record<string, number> = {};
    let total = 0;

    // batches of 5 paralelo
    for (let base = start; base < end; base += 500) {
      const promises: Promise<any[]>[] = [];
      for (let off = base; off < base + 500 && off < end; off += 100) {
        promises.push(
          fetch(`https://app.advbox.com.br/api/v1/lawsuits?limit=100&offset=${off}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }).then((r) => r.json()).then((b) => b?.data || [])
        );
      }
      const results = await Promise.all(promises);
      let batchEmpty = true;
      for (const items of results) {
        if (items.length > 0) batchEmpty = false;
        for (const it of items) {
          const s = it.stage ?? '__NULL__';
          stageCounts[s] = (stageCounts[s] || 0) + 1;
          const st = it.step ?? '__NULL__';
          stepCounts[st] = (stepCounts[st] || 0) + 1;
          total++;
        }
      }
      if (batchEmpty) break;
    }

    return new Response(JSON.stringify({ total, stageCounts, stepCounts }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
  return new Response(JSON.stringify({ status: r.status, keys, first_item: first, total: items?.length }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

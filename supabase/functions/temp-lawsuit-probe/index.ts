// Probe temporario para inspecionar GET /api/v1/lawsuits/:id (singular)
// Objetivo: descobrir se a rota por ID expoe campos nativos de outcome
// (won, victory, decision, archive_reason, etc.) que NAO aparecem no /lawsuits paginado.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get('ADVBOX_API_TOKEN');
  if (!token) return new Response(JSON.stringify({ error: 'no token' }), { status: 500, headers: corsHeaders });

  // 5 IDs com fees_money>0 e 5 com fees_money=null/0 (arquivados) — extraidos do cache
  const { ganhos, perdas } = await req.json().catch(() => ({ ganhos: [], perdas: [] }));

  const fetchOne = async (id: number) => {
    try {
      const r = await fetch(`https://app.advbox.com.br/api/v1/lawsuits/${id}`, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const text = await r.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* */ }
      return { id, status: r.status, keys: json ? Object.keys(json) : [], body: json ?? text.slice(0, 2000) };
    } catch (e) {
      return { id, error: (e as Error).message };
    }
  };

  const ganhoResults = await Promise.all(ganhos.slice(0, 5).map(fetchOne));
  const perdaResults = await Promise.all(perdas.slice(0, 5).map(fetchOne));

  return new Response(
    JSON.stringify({ ganhos: ganhoResults, perdas: perdaResults }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

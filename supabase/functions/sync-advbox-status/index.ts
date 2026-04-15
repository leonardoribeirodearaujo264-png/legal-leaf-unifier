import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const advboxToken = Deno.env.get("ADVBOX_API_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!advboxToken) {
      console.log("ADVBOX_API_TOKEN não configurado");
      return new Response(
        JSON.stringify({ success: false, message: "Token ADVBOX não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sincronizando status de processos do ADVBOX...");

    // Buscar contratos que foram sincronizados com ADVBOX
    const { data: contratos, error: contratosError } = await supabase
      .from('fin_contratos')
      .select('id, advbox_lawsuit_id, cliente_nome, produto')
      .eq('advbox_synced', true)
      .not('advbox_lawsuit_id', 'is', null);

    if (contratosError) throw contratosError;

    if (!contratos || contratos.length === 0) {
      console.log("Nenhum contrato sincronizado encontrado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum contrato para sincronizar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const atualizados: string[] = [];
    const erros: string[] = [];

    for (const contrato of contratos) {
      try {
        // Buscar dados do processo no ADVBOX
        const response = await fetch(`${ADVBOX_API_BASE}/lawsuits/${contrato.advbox_lawsuit_id}`, {
          headers: {
            'Authorization': `Bearer ${advboxToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn(`Erro ao buscar processo ${contrato.advbox_lawsuit_id}: ${response.status}`);
          erros.push(contrato.cliente_nome);
          continue;
        }

        const lawsuitData = await response.json();
        
        // Atualizar status no contrato local
        const novoStatus = lawsuitData.status || lawsuitData.phase?.name || null;
        const numeroProcesso = lawsuitData.process_number || null;

        if (novoStatus || numeroProcesso) {
          await supabase
            .from('fin_contratos')
            .update({
              status_processo: novoStatus,
              numero_processo: numeroProcesso,
              updated_at: new Date().toISOString()
            })
            .eq('id', contrato.id);

          atualizados.push(`${contrato.cliente_nome} - ${novoStatus || 'atualizado'}`);
        }

        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 2100)); // API rate limit: 30 req/min

      } catch (err) {
        console.error(`Erro ao processar contrato ${contrato.id}:`, err);
        erros.push(contrato.cliente_nome);
      }
    }

    // Criar alerta se houve atualizações
    if (atualizados.length > 0) {
      await supabase
        .from('fin_alertas')
        .insert({
          tipo: 'advbox_sync',
          mensagem: `${atualizados.length} processo(s) atualizado(s) do ADVBOX`,
          data_alerta: new Date().toISOString().split('T')[0]
        });
    }

    console.log(`Sincronização concluída: ${atualizados.length} atualizados, ${erros.length} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        total: contratos.length,
        atualizados: atualizados.length,
        erros: erros.length,
        detalhes: { atualizados, erros }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro na sincronização:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

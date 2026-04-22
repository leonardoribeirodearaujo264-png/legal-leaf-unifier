import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { instructions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um especialista em modelos de IA. Analise as instruções de um agente e escolha o modelo mais adequado.

Modelos disponíveis:
- "anthropic/claude-sonnet" → Melhor para: análise jurídica complexa, redação de petições, contratos, revisão detalhada de documentos legais, análise crítica profunda
- "openai/gpt-5" → Melhor para: raciocínio lógico complexo, cálculos, análise de dados, programação, resolução de problemas estruturados
- "perplexity/sonar-pro" → Melhor para: pesquisa em tempo real, busca de jurisprudência atualizada, consulta de legislação vigente, informações da web
- "google/gemini-2.5-flash" → Melhor para: conteúdo criativo, redação geral, resumos, tradução, atendimento ao cliente, tarefas rápidas

Responda APENAS com um JSON no formato:
{"model": "modelo_escolhido", "justification": "explicação breve em português"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Instruções do agente:\n${instructions}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_model",
              description: "Select the best AI model for the agent",
              parameters: {
                type: "object",
                properties: {
                  model: {
                    type: "string",
                    enum: ["anthropic/claude-sonnet", "openai/gpt-5", "perplexity/sonar-pro", "google/gemini-2.5-flash"]
                  },
                  justification: { type: "string" }
                },
                required: ["model", "justification"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "select_model" } }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gateway error:", response.status, errText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let result = { model: "google/gemini-2.5-flash", justification: "Modelo padrão selecionado" };
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch { /* use default */ }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ 
      model: "google/gemini-2.5-flash", 
      justification: "Modelo padrão (erro na seleção)", 
      error: e instanceof Error ? e.message : "Unknown" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

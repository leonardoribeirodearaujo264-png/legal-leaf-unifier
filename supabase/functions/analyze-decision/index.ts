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
    const { observation, decisao_texto, client_name, product_name, court, decision_type } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const textToAnalyze = [
      decisao_texto && `Texto da decisão: ${decisao_texto}`,
      observation && `Observação: ${observation}`,
      client_name && `Cliente: ${client_name}`,
      product_name && `Produto/Assunto: ${product_name}`,
      court && `Tribunal: ${court}`,
      decision_type && `Tipo de decisão: ${decision_type}`,
    ].filter(Boolean).join("\n");

    if (!textToAnalyze.trim()) {
      return new Response(JSON.stringify({ error: "Nenhum texto fornecido para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente jurídico especializado em análise de decisões judiciais brasileiras. 
Analise o texto fornecido e extraia as informações estruturadas. Responda APENAS com a chamada da função.`
          },
          { role: "user", content: textToAnalyze }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_decision",
              description: "Categoriza uma decisão judicial extraindo informações estruturadas",
              parameters: {
                type: "object",
                properties: {
                  reu: {
                    type: "string",
                    description: "Nome do réu na ação judicial. Se não identificável, retorne string vazia."
                  },
                  regiao: {
                    type: "string",
                    description: "Região/estado do tribunal (ex: MG, SP, RJ, Federal - 1ª Região). Se não identificável, retorne string vazia."
                  },
                  materia: {
                    type: "string",
                    enum: ["civil", "trabalhista", "previdenciario", "tributario", "administrativo", "consumidor", "imobiliario", "servidor_publico", "outro"],
                    description: "Matéria/área do direito da decisão"
                  },
                  resultado: {
                    type: "string",
                    enum: ["procedente", "improcedente", "parcialmente_procedente", "nao_identificado"],
                    description: "Resultado da decisão: procedente, improcedente ou parcialmente procedente"
                  },
                  resumo: {
                    type: "string",
                    description: "Breve resumo da decisão em até 2 frases"
                  }
                },
                required: ["reu", "regiao", "materia", "resultado", "resumo"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "categorize_decision" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na análise de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-decision error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

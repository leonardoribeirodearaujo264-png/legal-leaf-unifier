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
    const { name, objective, userInput } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const systemPrompt = `Você é um especialista em criar instruções detalhadas para agentes de IA. 
Dado o nome, objetivo e descrição do usuário, gere instruções completas e estruturadas em português para o agente.
As instruções devem incluir:
1. Papel e identidade do agente
2. Regras de comportamento e tom de voz
3. Passos detalhados para executar as tarefas
4. Formato de saída esperado
5. Limitações e avisos importantes
6. Exemplos de uso quando aplicável

Retorne APENAS as instruções, sem explicações adicionais. Seja detalhado e preciso.`;

    const userMessage = `Nome do agente: ${name}
Objetivo: ${objective}
Descrição do usuário: ${userInput || 'Gere instruções baseadas no nome e objetivo acima.'}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          { role: "user", content: systemPrompt + "\n\n" + userMessage }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const instructions = data.content?.[0]?.text || "";

    return new Response(JSON.stringify({ instructions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

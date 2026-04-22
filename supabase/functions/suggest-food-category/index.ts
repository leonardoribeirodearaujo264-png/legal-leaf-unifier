import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { foodName } = await req.json();

    if (!foodName || foodName.trim().length < 2) {
      return new Response(
        JSON.stringify({ category: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que categoriza alimentos para uma copa/cozinha de escritório. 
Dado o nome de um alimento, responda APENAS com UMA das seguintes categorias (exatamente como escrito):
- Bebidas (para água, sucos, refrigerantes, energéticos, etc.)
- Café/Chá (para café, chá, cappuccino, achocolatado, etc.)
- Laticínios (para leite, queijo, iogurte, manteiga, requeijão, cream cheese, etc.)
- Snacks (para biscoitos, chips, salgadinhos, amendoim, castanhas, etc.)
- Frutas (para frutas frescas ou secas, como maçã, banana, uva passa, etc.)
- Lanches (para sanduíches, wraps, hambúrgueres, etc.)
- Pães (para pão de forma, pão francês, torradas, bisnaguinha, croissant, etc.)
- Doces (para chocolate, balas, brigadeiro, sobremesas, sorvete, etc.)
- Condimentos (para ketchup, maionese, mostarda, sal, açúcar, adoçante, etc.)
- Cereais/Grãos (para granola, aveia, cereal matinal, arroz, etc.)
- Outros (para itens que não se encaixam nas categorias anteriores)

Responda APENAS com o nome da categoria, nada mais.`
          },
          {
            role: "user",
            content: `Categorize: "${foodName}"`
          }
        ],
        max_tokens: 20,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", category: "Outros" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", category: "Outros" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ category: "Outros" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let suggestedCategory = data.choices?.[0]?.message?.content?.trim() || "Outros";

    // Normalize the response to match our exact categories
    const validCategories = ["Bebidas", "Café/Chá", "Laticínios", "Snacks", "Frutas", "Lanches", "Pães", "Doces", "Condimentos", "Cereais/Grãos", "Outros"];
    const normalizedCategory = validCategories.find(
      cat => suggestedCategory.toLowerCase().includes(cat.toLowerCase())
    ) || "Outros";

    return new Response(
      JSON.stringify({ category: normalizedCategory }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in suggest-food-category:", error);
    return new Response(
      JSON.stringify({ category: "Outros", error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

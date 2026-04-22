import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `Você é um advogado sênior especialista em análise de viabilidade jurídica no Brasil, com vasta experiência em contencioso e consultivo.

Analise PROFUNDAMENTE os dados do cliente e do caso apresentado. Sua análise deve ser DETALHADA, FUNDAMENTADA e de altíssima qualidade técnica.

Seu parecer DEVE seguir exatamente este formato:

**RECOMENDAÇÃO:** [VIÁVEL | INVIÁVEL | NECESSITA MAIS DADOS]

**RESUMO EXECUTIVO:**
[Resumo objetivo em 3-5 frases sobre a viabilidade do caso, incluindo probabilidade estimada de êxito]

**ANÁLISE JURÍDICA DETALHADA:**
[Análise aprofundada do mérito do caso, incluindo enquadramento legal, elementos constitutivos, pressupostos processuais e condições da ação]

**FUNDAMENTAÇÃO LEGAL:**
- [Cite artigos de lei, códigos, súmulas, orientações jurisprudenciais e teses fixadas em repetitivos/repercussão geral que se aplicam]
- [Fundamente cada ponto relevante com a norma aplicável]

**JURISPRUDÊNCIA RELEVANTE:**
- [Cite decisões recentes de tribunais superiores (STF, STJ, TST) e tribunais estaduais/regionais que corroboram ou contrariam a tese]
- [Indique se há jurisprudência consolidada ou divergência entre tribunais]

**PONTOS FAVORÁVEIS:**
- [Liste cada ponto que fortalece a pretensão, com fundamentação]

**PONTOS DE ATENÇÃO E RISCOS:**
- [Liste riscos processuais, matérias de defesa provável, prescrição, decadência, questões probatórias]
- [Indique a probabilidade de cada risco se materializar]

**ESTIMATIVA DE PRAZO E CUSTOS:**
- Tempo estimado até sentença de 1ª instância
- Possibilidade de recursos e tempo adicional
- Custas processuais estimadas
- Honorários advocatícios de sucumbência (risco)

**ESTRATÉGIA PROCESSUAL SUGERIDA:**
- [Sugira o rito processual mais adequado]
- [Indique se cabe tutela de urgência]
- [Sugira provas a serem produzidas]

**PRÓXIMOS PASSOS RECOMENDADOS:**
1. [Passo concreto e acionável]
2. [Passo concreto e acionável]
3. [Passo concreto e acionável]

Seja extremamente técnico, preciso e profissional. Considere a legislação brasileira vigente, incluindo alterações recentes.`;

function buildUserPrompt(data: any): string {
  return `Analise a viabilidade jurídica do seguinte caso com MÁXIMA PROFUNDIDADE:

**DADOS DO CLIENTE:**
- Nome: ${data.nome}
- CPF: ${data.cpf || "Não informado"}
- Data de Nascimento: ${data.data_nascimento || "Não informada"}
- Telefone: ${data.telefone || "Não informado"}
- Email: ${data.email || "Não informado"}
- Endereço: ${data.endereco || "Não informado"}

**TIPO DE AÇÃO:** ${data.tipo_acao}

**DESCRIÇÃO DO CASO:**
${data.descricao_caso}

Forneça seu parecer completo de viabilidade jurídica, com fundamentação legal, jurisprudência e análise de riscos.`;
}

async function callClaude(userPrompt: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Claude API error:", response.status, errorText);
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 401) throw new Error("AUTH_ERROR");
    throw new Error("Erro na API Claude");
  }

  const data = await response.json();
  return data.content?.[0]?.text || "Não foi possível gerar o parecer.";
}

async function callOpenAI(userPrompt: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "o3",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      reasoning_effort: "high",
      max_completion_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 401) throw new Error("AUTH_ERROR");
    throw new Error("Erro na API OpenAI");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Não foi possível gerar o parecer.";
}

async function generateTitle(tipoAcao: string, descricaoCaso: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not available for title generation, using tipo_acao as fallback");
    return tipoAcao || "Análise Jurídica";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Você gera títulos curtos para casos jurídicos. Responda APENAS com o título, sem aspas, sem pontuação final. Máximo 8 palavras.",
          },
          {
            role: "user",
            content: `Tipo de ação: ${tipoAcao}\nDescrição: ${descricaoCaso.substring(0, 500)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Title generation error:", response.status);
      return tipoAcao || "Análise Jurídica";
    }

    const data = await response.json();
    const titulo = data.choices?.[0]?.message?.content?.trim();
    return titulo || tipoAcao || "Análise Jurídica";
  } catch (err) {
    console.error("Title generation failed:", err);
    return tipoAcao || "Análise Jurídica";
  }
}

function extractRecomendacao(parecer: string): string {
  const upper = parecer.toUpperCase();
  if (upper.includes("**RECOMENDAÇÃO:** VIÁVEL") || upper.includes("RECOMENDAÇÃO:** VIÁVEL")) {
    const idx = upper.indexOf("RECOMENDAÇÃO:**");
    if (idx !== -1) {
      const after = upper.substring(idx, idx + 40);
      if (after.includes("INVIÁVEL")) return "inviavel";
    }
    return "viavel";
  }
  if (upper.includes("INVIÁVEL")) return "inviavel";
  if (upper.includes("NECESSITA MAIS DADOS")) return "necessita_mais_dados";
  return "necessita_mais_dados";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const body = await req.json();
    const { nome, tipo_acao, descricao_caso, modelo } = body;

    if (!nome || !tipo_acao || !descricao_caso) {
      return new Response(
        JSON.stringify({ error: "Nome, tipo de ação e descrição do caso são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = buildUserPrompt(body);
    const selectedModel = modelo === "chatgpt" ? "chatgpt" : "claude";

    console.log(`Analyzing viability with model: ${selectedModel}`);

    let parecer: string;
    try {
      parecer = selectedModel === "chatgpt"
        ? await callOpenAI(userPrompt)
        : await callClaude(userPrompt);
    } catch (err: any) {
      if (err.message === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (err.message === "AUTH_ERROR") {
        return new Response(
          JSON.stringify({ error: "Erro de autenticação com a API de IA." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    const recomendacao = extractRecomendacao(parecer);

    // Generate short title via Lovable AI
    const titulo = await generateTitle(tipo_acao, descricao_caso);
    console.log(`Generated title: ${titulo}`);

    return new Response(
      JSON.stringify({ parecer, recomendacao, titulo, modelo_usado: selectedModel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-viability error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

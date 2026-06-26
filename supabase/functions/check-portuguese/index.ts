import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function extractTextFromDocx(base64: string): Promise<string> {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("Arquivo DOCX inválido: word/document.xml não encontrado.");

  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(docXml)) !== null) {
    const texts: string[] = [];
    const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(paraMatch[0])) !== null) {
      texts.push(textMatch[1]);
    }
    if (texts.length > 0) {
      paragraphs.push(texts.join(""));
    }
  }

  return paragraphs.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { file_base64, file_name } = await req.json();
    if (!file_base64 || !file_name) {
      return new Response(JSON.stringify({ error: "Arquivo não fornecido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = file_name.split(".").pop()?.toLowerCase();
    const isDocx = ext === "docx" || ext === "doc";

    let extractedText: string;

    if (isDocx) {
      console.log("Step 1: Extracting text from DOCX locally...");
      extractedText = await extractTextFromDocx(file_base64);
    } else {
      // PDF: use Gemini multimodal for extraction (Claude doesn't support PDF multimodal inline)
      console.log("Step 1: Extracting text from PDF via Gemini...");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const mimeType = "application/pdf";
      const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extraia TODO o texto deste documento de forma fiel, mantendo a estrutura de parágrafos. Retorne apenas o texto extraído, sem comentários adicionais.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${file_base64}` },
                },
              ],
            },
          ],
        }),
      });

      if (!extractResponse.ok) {
        const status = extractResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes para processar o documento." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const errText = await extractResponse.text();
        console.error("Extract error:", status, errText);
        return new Response(JSON.stringify({ error: "Erro ao extrair texto do documento." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const extractData = await extractResponse.json();
      extractedText = extractData.choices?.[0]?.message?.content || "";
    }

    if (!extractedText || extractedText.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair texto suficiente do documento." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Text extracted: ${extractedText.length} chars`);

    // Step 2: Analyze grammar using Claude Sonnet (superior for grammar analysis)
    // Large documents are split into chunks to stay within token limits
    console.log("Step 2: Analyzing grammar with Claude Sonnet...");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const GRAMMAR_SYSTEM_PROMPT = `Você é um revisor especialista em língua portuguesa brasileira (norma culta). Sua tarefa é analisar o texto fornecido e identificar TODOS os erros gramaticais, ortográficos e de estilo.

Regras:
- Categorize cada erro em: ortografia, concordancia, regencia, pontuacao, crase, acentuacao, coesao, outro
- IGNORE nomes próprios, termos jurídicos técnicos, citações legais, números de processos e artigos de lei
- Indique a localização aproximada (ex: "parágrafo 1", "início do texto", "trecho X")
- NÃO corrija o texto, apenas liste os erros encontrados
- Para cada erro, forneça o trecho exato, a descrição do erro, a sugestão de correção e a localização
- Seja preciso e minucioso, mas não invente erros inexistentes
- Se não houver erros, retorne uma lista vazia

IMPORTANTE: Responda EXCLUSIVAMENTE com um JSON válido no formato:
{"erros": [{"trecho": "...", "erro": "...", "tipo": "...", "sugestao": "...", "localizacao": "..."}]}

Tipos válidos: ortografia, concordancia, regencia, pontuacao, crase, acentuacao, coesao, outro`;

    const analyzeChunk = async (chunkText: string, chunkLabel: string): Promise<any[]> => {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: GRAMMAR_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Analise o seguinte trecho (${chunkLabel}) e identifique todos os erros de português. Responda apenas com o JSON:\n\n${chunkText}`,
            },
          ],
        }),
      });

      if (!resp.ok) {
        const status = resp.status;
        if (status === 429) throw Object.assign(new Error("rate_limit"), { status: 429 });
        if (status === 401) throw Object.assign(new Error("auth_error"), { status: 401 });
        const errText = await resp.text();
        console.error(`Analyze chunk error (${chunkLabel}):`, status, errText);
        throw new Error("Erro ao analisar gramática do texto.");
      }

      const data = await resp.json();
      const responseText = data.content?.[0]?.text || "{}";

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return (parsed.erros || []).map((e: any) => ({
            ...e,
            localizacao: e.localizacao ? `${chunkLabel} – ${e.localizacao}` : chunkLabel,
          }));
        }
      } catch (e) {
        console.error(`Failed to parse Claude response for ${chunkLabel}:`, e);
      }
      return [];
    };

    // Split into ~80 000-char chunks so each fits Claude's context window
    const CHUNK_SIZE = 80_000;
    let erros: any[] = [];

    if (extractedText.length <= CHUNK_SIZE) {
      // Small document — single request
      try {
        erros = await analyzeChunk(extractedText, "documento completo");
      } catch (err: any) {
        if (err.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (err.status === 401) return new Response(JSON.stringify({ error: "Erro de autenticação com a API Anthropic." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Erro ao analisar gramática do texto." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      // Large document — process in sequential chunks
      const totalChunks = Math.ceil(extractedText.length / CHUNK_SIZE);
      console.log(`Documento grande: ${totalChunks} partes de ~${CHUNK_SIZE} chars`);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunkText = extractedText.slice(start, start + CHUNK_SIZE);
        const chunkLabel = `parte ${i + 1} de ${totalChunks}`;

        try {
          const chunkErrors = await analyzeChunk(chunkText, chunkLabel);
          erros = erros.concat(chunkErrors);
          console.log(`${chunkLabel}: ${chunkErrors.length} erro(s) encontrado(s)`);
        } catch (err: any) {
          if (err.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          if (err.status === 401) return new Response(JSON.stringify({ error: "Erro de autenticação com a API Anthropic." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          console.error(`Erro ao processar ${chunkLabel}, continuando...`);
        }
      }
    }

    console.log(`Analysis complete: ${erros.length} errors found`);

    return new Response(JSON.stringify({ erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-portuguese error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

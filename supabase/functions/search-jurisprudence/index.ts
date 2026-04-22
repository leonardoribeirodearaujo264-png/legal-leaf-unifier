import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { query, court } = await req.json();
    
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build court filter text
    let courtFilter = '';
    if (court && court !== 'todos') {
      const courtNames: Record<string, string> = {
        'STF': 'Supremo Tribunal Federal (STF)',
        'STJ': 'Superior Tribunal de Justiça (STJ)',
        'TST': 'Tribunal Superior do Trabalho (TST)',
        'TRF': 'Tribunais Regionais Federais (TRFs)',
        'TJ': 'Tribunais de Justiça Estaduais (TJs)',
        'TRT': 'Tribunais Regionais do Trabalho (TRTs)'
      };
      courtFilter = `Foque especificamente em decisões do ${courtNames[court] || court}.`;
    }

    // Detect if user specified a number of jurisprudence to return
    const numberMatch = query.match(/(\d+)\s*jurisprud[êe]ncia/i);
    const requestedCount = numberMatch ? parseInt(numberMatch[1]) : 5;
    const maxResults = Math.min(Math.max(requestedCount, 3), 15); // Between 3 and 15

    console.log('Searching jurisprudence for:', query, 'Court:', court || 'todos', 'Requested count:', maxResults);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente jurídico especializado em pesquisa de jurisprudência brasileira.
Sua função é encontrar e apresentar decisões judiciais relevantes dos tribunais brasileiros.

${courtFilter}

Para cada decisão encontrada, retorne um JSON estruturado:

{
  "jurisprudencias": [
    {
      "tribunal": "Nome do tribunal (ex: STF, STJ, TJ-SP, TRT-2)",
      "numero_processo": "Número completo do processo",
      "relator": "Nome do relator/desembargador",
      "orgao_julgador": "Turma, Câmara ou Seção que julgou (ex: 2ª Turma, 3ª Câmara de Direito Privado)",
      "data_julgamento": "Data do julgamento no formato DD/MM/AAAA",
      "ementa": "EMENTA COMPLETA E INTEGRAL da decisão, sem resumir ou truncar. Copie a ementa inteira como consta no acórdão, incluindo todos os tópicos e parágrafos.",
      "resumo": "Breve resumo em 2-3 frases explicando a decisão de forma didática",
      "area_direito": "civil|trabalhista|penal|tributario|administrativo|constitucional|previdenciario|consumidor|ambiental|empresarial|familia|outro",
      "assunto": "Tema principal da decisão (ex: Dano moral, Rescisão contratual, Indenização por acidente)",
      "tese_firmada": "Tese jurídica principal firmada na decisão",
      "palavras_chave": ["palavra1", "palavra2", "palavra3"],
      "link_fonte": "URL da fonte original da decisão (site do tribunal, JusBrasil, etc.) quando disponível, ou null se não encontrada"
    }
  ],
  "observacoes_gerais": "Observações sobre os resultados encontrados"
}

REGRAS IMPORTANTES:
1. Busque EXATAMENTE ${maxResults} jurisprudências relevantes e recentes
2. A EMENTA deve ser COMPLETA e INTEGRAL - não resuma, não trunque, copie integralmente
3. Retorne APENAS o JSON, sem texto adicional
4. Seja preciso nas citações e números de processos
5. Inclua o órgão julgador (Turma, Câmara, Seção) quando disponível
6. Identifique corretamente a área do direito e o assunto principal
7. Para cada jurisprudência, inclua o link_fonte com a URL original quando disponível`
          },
          {
            role: 'user',
            content: `Pesquise ${maxResults} jurisprudências RECENTES e RELEVANTES sobre: ${query}

IMPORTANTE: Traga a EMENTA COMPLETA de cada decisão, sem resumir ou cortar.`
          }
        ],
        temperature: 0.2,
        max_tokens: 8000,
        return_images: false,
        return_related_questions: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro na API: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const rawResult = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    console.log('Search completed successfully, citations:', citations.length);

    // Try to parse as JSON
    let parsedResult = null;
    try {
      // Find JSON in the response
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log('Could not parse as JSON, returning raw result');
    }

    return new Response(
      JSON.stringify({ 
        result: rawResult,
        parsed: parsedResult,
        citations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-jurisprudence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

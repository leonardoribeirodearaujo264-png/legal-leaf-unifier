import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PetitionSuggestionRequest {
  processType: string;
  processGroup: string;
  processNumber?: string;
  clientName?: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { processType, processGroup, clientName, processNumber, description } = await req.json() as PetitionSuggestionRequest;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    console.log('Generating petition suggestion for:', { processType, processGroup });

    const systemPrompt = `Você é um especialista em petições jurídicas brasileiras. Sua função é sugerir o tipo de petição mais adequado com base no tipo de processo e sua área jurídica.

Ao receber informações sobre um processo, você deve:
1. Identificar a fase processual provável
2. Sugerir 2-3 tipos de petições mais relevantes para esse tipo de caso
3. Para cada petição, fornecer:
   - Nome da petição
   - Quando usar (em que situação)
   - Estrutura básica (tópicos principais)
   - Fundamentação legal aplicável
   - Dicas práticas

Seja específico para o direito brasileiro e considere as particularidades de cada área do direito.`;

    const userPrompt = `Preciso de sugestões de petições para o seguinte processo:

Tipo do Processo: ${processType}
Área/Grupo: ${processGroup}
${processNumber ? `Número do Processo: ${processNumber}` : ''}
${clientName ? `Cliente: ${clientName}` : ''}
${description ? `Descrição adicional: ${description}` : ''}

Por favor, sugira os tipos de petições mais adequados para este caso, considerando diferentes cenários e fases processuais.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Taxa de requisições excedida. Tente novamente em alguns instantes.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'Erro de autenticação com a API Anthropic.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const suggestion = data.content?.[0]?.text;

    if (!suggestion) {
      throw new Error('No suggestion generated');
    }

    console.log('Petition suggestion generated successfully');

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-petition:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro ao gerar sugestão de petição' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

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
    const { title, position } = await req.json();
    
    if (!title && !position) {
      return new Response(
        JSON.stringify({ error: 'Título ou cargo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const positionLabels: Record<string, string> = {
      'socio': 'Sócio',
      'advogado': 'Advogado',
      'estagiario': 'Estagiário de Direito',
      'comercial': 'Comercial',
      'administrativo': 'Administrativo'
    };

    const positionLabel = positionLabels[position] || position;

    const systemPrompt = `Você é um especialista em RH de um escritório de advocacia brasileiro.

Sua tarefa é gerar uma descrição de vaga e requisitos profissionais para uma vaga de emprego em um escritório de advocacia.

IMPORTANTE: 
- NÃO mencione localização específica, cidade ou estado
- NÃO mencione áreas de atuação específicas a menos que sejam explicitamente informadas
- Mantenha a descrição genérica o suficiente para se aplicar a qualquer escritório de advocacia
- Use português brasileiro correto e formal
- NÃO use caracteres especiais, emojis ou formatação markdown
- Escreva texto limpo e direto

Responda APENAS em formato JSON válido com a seguinte estrutura:
{
  "description": "Descrição detalhada da vaga com responsabilidades e atividades",
  "requirements": "Lista de requisitos e qualificações necessárias"
}`;

    const userPrompt = `Gere descrição e requisitos para a seguinte vaga:

Título da Vaga: ${title || 'Não especificado'}
Cargo: ${positionLabel}

Considere:
- Para cargos jurídicos (advogado, estagiário): foque em competências gerais da advocacia como pesquisa jurídica, redação de peças, atendimento a clientes, prazos processuais
- Para cargos administrativos: foque em organização, atendimento e suporte ao escritório
- Para cargos comerciais: foque em captação de clientes e relacionamento

NÃO mencione localização, cidade ou áreas específicas de atuação do escritório.
Escreva em português brasileiro sem caracteres especiais ou formatação.`;

    console.log('Calling Lovable AI for job opening suggestions...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);

    // Clean the content - remove markdown code blocks and clean up text
    let cleanContent = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();

    // Parse JSON from response
    let suggestion = { description: '', requirements: '' };
    try {
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Clean the parsed content
        suggestion = {
          description: (parsed.description || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#{1,6}\s*/g, '')
            .replace(/`/g, '')
            .trim(),
          requirements: (parsed.requirements || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#{1,6}\s*/g, '')
            .replace(/`/g, '')
            .trim()
        };
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback with clean generic text
      suggestion = {
        description: `Vaga para ${positionLabel}. Atuação em atividades jurídicas gerais incluindo pesquisa, redação de peças processuais, atendimento a clientes e acompanhamento de prazos.`,
        requirements: `Formação em Direito. Boa comunicação escrita e verbal. Organização e atenção a prazos. Proatividade e trabalho em equipe.`
      };
    }

    return new Response(
      JSON.stringify(suggestion),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );

  } catch (error) {
    console.error('Error in suggest-job-opening:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar sugestões';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
});
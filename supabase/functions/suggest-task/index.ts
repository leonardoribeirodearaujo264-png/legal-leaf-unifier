// Edge Function para sugerir tarefas usando IA baseado no conteúdo da publicação/movimentação

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestTaskRequest {
  publicationContent: string;
  movementTitle?: string;
  processNumber?: string;
  customerName?: string;
  court?: string;
  taskTypes?: { id: string | number; name: string }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY não está configurada');
    }

    const body: SuggestTaskRequest = await req.json();
    const { publicationContent, movementTitle, processNumber, customerName, court, taskTypes } = body;

    if (!publicationContent && !movementTitle) {
      return new Response(JSON.stringify({ error: 'publicationContent ou movementTitle é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analyzing publication for task suggestion:', {
      movementTitle: movementTitle?.substring(0, 100),
      content: publicationContent?.substring(0, 200),
    });

    // Construir lista de tipos de tarefa disponíveis
    const taskTypesList = taskTypes?.length 
      ? taskTypes.map(t => `- ${t.id}: ${t.name}`).join('\n')
      : `- audiência
- prazo
- intimação
- sentença
- recurso
- despacho
- petição
- diligência
- perícia
- outro`;

    const systemPrompt = `Você é um advogado processualista brasileiro sênior com 20 anos de experiência. Sua tarefa é analisar movimentações processuais e sugerir a PRÓXIMA AÇÃO CONCRETA que o advogado deve tomar.

REGRAS ABSOLUTAS:
1. A tarefa DEVE ser uma ação DIRETA e ESPECÍFICA em resposta ao conteúdo da movimentação
2. NUNCA sugira tarefas genéricas como "conferir publicações", "verificar andamento", "acompanhar processo" ou "monitorar publicações"
3. Se a movimentação indica uma AÇÃO FUTURA (julgamento, audiência, perícia), sugira PREPARAÇÃO para essa ação
4. Se a movimentação indica uma DECISÃO ou DESPACHO, sugira a resposta processual adequada
5. Seja ESPECÍFICO — mencione o tipo de peça, o prazo, a providência exata

EXEMPLOS DE MOVIMENTAÇÕES E TAREFAS CORRETAS:

JULGAMENTO:
- "Designado para julgamento virtual" → "Avaliar necessidade de oposição ao julgamento virtual e preparar sustentação oral"
- "Designado julgamento pelo colegiado" → "Preparar sustentação oral e verificar pauta de julgamento"
- "Incluído em pauta de julgamento" → "Preparar memoriais e sustentação oral para julgamento"
- "Julgamento convertido em diligência" → "Verificar diligência determinada e cumprir exigência"

SENTENÇA E DECISÕES:
- "Proferida sentença procedente" → "Analisar dispositivo da sentença e comunicar cliente sobre resultado favorável"
- "Proferida sentença improcedente" → "Analisar sentença para interposição de recurso de apelação"
- "Sentença parcialmente procedente" → "Analisar pontos deferidos/indeferidos e avaliar recurso parcial"
- "Decisão monocrática — negado seguimento" → "Analisar cabimento de agravo interno contra decisão monocrática"
- "Decisão monocrática — dado provimento" → "Comunicar cliente e verificar trânsito em julgado"
- "Decisão interlocutória — indeferido pedido de tutela" → "Avaliar interposição de agravo de instrumento"

INTIMAÇÕES:
- "Intimação para manifestação sobre laudo pericial" → "Analisar laudo pericial e elaborar manifestação técnica"
- "Intimação para contrarrazões de recurso" → "Elaborar contrarrazões ao recurso interposto"
- "Intimação para especificar provas" → "Elaborar petição de especificação de provas"
- "Intimação para pagamento (art. 523 CPC)" → "Orientar cliente sobre pagamento voluntário ou elaborar impugnação"

CITAÇÃO:
- "Citação para contestar" → "Elaborar contestação no prazo legal"
- "Citação para audiência de conciliação" → "Preparar proposta de acordo e orientar cliente para audiência"

DESPACHOS:
- "Despacho: Diga a parte autora" → "Elaborar petição de manifestação conforme determinado"
- "Despacho: Emenda à inicial" → "Emendar petição inicial conforme determinação judicial"
- "Despacho: Junte procuração" → "Juntar procuração atualizada aos autos"
- "Despacho: Manifestem-se sobre os documentos" → "Analisar documentos juntados e elaborar manifestação"

AUDIÊNCIAS:
- "Designada audiência de instrução" → "Preparar rol de testemunhas, documentos e quesitos para audiência"
- "Designada audiência de conciliação" → "Preparar proposta de acordo e orientar cliente"
- "Audiência redesignada" → "Atualizar agenda e comunicar cliente sobre nova data"

RECURSOS:
- "Juntada de AR positivo" → "Verificar início do prazo processual e calcular término"
- "Certidão de publicação" → "Calcular prazo recursal e providenciar peça processual"
- "Recurso de apelação interposto pela parte contrária" → "Elaborar contrarrazões de apelação"
- "Recurso especial admitido" → "Preparar contrarrazões ao recurso especial"

PERÍCIA:
- "Nomeado perito judicial" → "Indicar assistente técnico e elaborar quesitos"
- "Laudo pericial juntado" → "Analisar laudo pericial e elaborar parecer técnico divergente se necessário"

CUMPRIMENTO DE SENTENÇA:
- "Trânsito em julgado" → "Iniciar cumprimento de sentença ou verificar obrigação a cumprir"
- "Expedido mandado de penhora" → "Acompanhar cumprimento do mandado e indicar bens se necessário"
- "Bloqueio de valores via SISBAJUD" → "Verificar valores bloqueados e avaliar necessidade de desbloqueio"

TIPOS DE TAREFA DISPONÍVEIS:
${taskTypesList}

Responda SEMPRE em formato JSON com esta estrutura EXATA:
{
  "suggestedTaskType": "nome do tipo de tarefa mais adequado da lista acima",
  "suggestedTaskTypeId": "id do tipo se disponível, ou null",
  "taskTitle": "título curto e descritivo ESPECÍFICO para esta movimentação (máx 80 caracteres)",
  "taskDescription": "descrição detalhada do que precisa ser feito, mencionando peças processuais, prazos e providências concretas",
  "suggestedDeadline": "data do prazo se identificada no texto (formato YYYY-MM-DD) ou null",
  "isUrgent": true ou false,
  "isImportant": true ou false,
  "reasoning": "explicação de POR QUE esta tarefa específica é necessária em resposta a esta movimentação"
}`;

    const contentParts = [];
    if (movementTitle) contentParts.push(`TÍTULO DA MOVIMENTAÇÃO: ${movementTitle}`);
    if (publicationContent && publicationContent !== movementTitle) {
      contentParts.push(`DESCRIÇÃO/CONTEÚDO COMPLETO:\n${publicationContent}`);
    }

    const userPrompt = `Analise esta movimentação processual e sugira a tarefa ESPECÍFICA que o advogado deve executar:

PROCESSO: ${processNumber || 'Não informado'}
CLIENTE: ${customerName || 'Não informado'}
TRIBUNAL: ${court || 'Não informado'}

${contentParts.join('\n\n')}

LEMBRE-SE: Não sugira "conferir publicações" ou qualquer tarefa genérica. Sugira a AÇÃO PROCESSUAL CONCRETA.
Responda APENAS com o JSON, sem texto adicional.`;

    // Retry logic with exponential backoff for 529 (Overloaded)
    const MAX_RETRIES = 2;
    const INITIAL_DELAY = 2000;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) break;

      if (response.status === 529 && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt);
        console.warn(`Anthropic API overloaded (529). Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Not a retryable error or retries exhausted — handle it
      break;
    }

    // If Anthropic failed, try OpenAI as fallback
    if (!response!.ok) {
      const anthropicStatus = response!.status;
      const anthropicError = await response!.text();
      console.warn(`Anthropic failed (${anthropicStatus}). Attempting OpenAI fallback...`, anthropicError);

      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (OPENAI_API_KEY) {
        try {
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              max_tokens: 1000,
              temperature: 0.3,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          });

          if (openaiResponse.ok) {
            console.log('OpenAI fallback succeeded');
            const openaiData = await openaiResponse.json();
            const fallbackContent = openaiData.choices?.[0]?.message?.content;
            if (fallbackContent) {
              // Parse and return the fallback response
              let suggestion;
              try {
                const jsonStr = fallbackContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                suggestion = JSON.parse(jsonStr);
              } catch {
                suggestion = {
                  suggestedTaskType: 'Análise de movimentação',
                  suggestedTaskTypeId: null,
                  taskTitle: `Analisar movimentação - ${processNumber || 'Processo'}`,
                  taskDescription: 'Verificar e tomar providências sobre a movimentação recente do processo.',
                  suggestedDeadline: null,
                  isUrgent: false,
                  isImportant: true,
                  reasoning: 'Sugestão padrão via IA alternativa.',
                };
              }
              return new Response(JSON.stringify(suggestion), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } else {
            console.error('OpenAI fallback also failed:', openaiResponse.status);
          }
        } catch (fallbackErr) {
          console.error('OpenAI fallback error:', fallbackErr);
        }
      }

      // Both failed — return user-friendly error based on original Anthropic status
      if (anthropicStatus === 529) {
        return new Response(JSON.stringify({ 
          error: 'O serviço de IA está temporariamente sobrecarregado. Tente novamente em alguns segundos.' 
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (anthropicStatus === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' 
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (anthropicStatus === 401) {
        return new Response(JSON.stringify({ 
          error: 'Erro de autenticação com a API.' 
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if ((anthropicStatus === 400 && anthropicError.toLowerCase().includes('credit balance')) || anthropicStatus === 402) {
        return new Response(JSON.stringify({ 
          error: 'A API de IA está sem créditos. Entre em contato com o administrador.' 
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const errorMessage = (() => {
        try {
          return JSON.parse(anthropicError)?.error?.message || `Erro da API (${anthropicStatus})`;
        } catch {
          return `Erro da API (${anthropicStatus})`;
        }
      })();
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response!.json();
    const content = aiResponse.content?.[0]?.text;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('AI response:', content);

    // Tentar extrair JSON da resposta
    let suggestion;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestion = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      suggestion = {
        suggestedTaskType: 'Análise de movimentação',
        suggestedTaskTypeId: null,
        taskTitle: `Analisar movimentação - ${processNumber || 'Processo'}`,
        taskDescription: `Verificar e tomar providências sobre a movimentação recente do processo.`,
        suggestedDeadline: null,
        isUrgent: false,
        isImportant: true,
        reasoning: 'Sugestão padrão - não foi possível analisar o conteúdo automaticamente.',
      };
    }

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-task function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

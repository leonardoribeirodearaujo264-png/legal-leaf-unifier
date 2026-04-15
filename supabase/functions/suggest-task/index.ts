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
  freeForm?: boolean;
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
    const { publicationContent, movementTitle, processNumber, customerName, court, taskTypes, freeForm } = body;

    if (!publicationContent && !movementTitle) {
      return new Response(JSON.stringify({ error: 'publicationContent ou movementTitle é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analyzing for task suggestion:', {
      freeForm,
      movementTitle: movementTitle?.substring(0, 100),
      content: publicationContent?.substring(0, 200),
    });

    const taskTypesList = taskTypes?.length
      ? taskTypes.map(t => `- ${t.id}: ${t.name}`).join('\n')
      : `- audiência\n- prazo\n- intimação\n- sentença\n- recurso\n- despacho\n- petição\n- diligência\n- perícia\n- outro`;

    // Build system prompt based on mode
    const systemPrompt = freeForm
      ? buildFreeFormPrompt(taskTypesList)
      : buildMovementPrompt(taskTypesList);

    const contentParts = [];
    if (movementTitle) contentParts.push(`TÍTULO DA MOVIMENTAÇÃO: ${movementTitle}`);
    if (publicationContent && publicationContent !== movementTitle) {
      contentParts.push(`DESCRIÇÃO/CONTEÚDO COMPLETO:\n${publicationContent}`);
    }

    const userPrompt = freeForm
      ? `Analise esta descrição de tarefa fornecida pelo advogado e sugira os detalhes para criação:\n\nPROCESSO: ${processNumber || 'Não informado'}\nCLIENTE: ${customerName || 'Não informado'}\n\n${contentParts.join('\n\n')}\n\nResponda APENAS com o JSON, sem texto adicional.`
      : `Analise esta movimentação processual e sugira a tarefa ESPECÍFICA que o advogado deve executar:\n\nPROCESSO: ${processNumber || 'Não informado'}\nCLIENTE: ${customerName || 'Não informado'}\nTRIBUNAL: ${court || 'Não informado'}\n\n${contentParts.join('\n\n')}\n\nLEMBRE-SE: Não sugira "conferir publicações" ou qualquer tarefa genérica. Sugira a AÇÃO PROCESSUAL CONCRETA.\nResponda APENAS com o JSON, sem texto adicional.`;

    // Retry logic with exponential backoff for 529
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
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.3,
        }),
      });

      if (response.ok) break;

      if (response.status === 529 && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt);
        console.warn(`Anthropic API overloaded (529). Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }

    // Fallback to OpenAI if Anthropic failed
    if (!response!.ok) {
      const anthropicStatus = response!.status;
      const anthropicError = await response!.text();
      console.warn(`Anthropic failed (${anthropicStatus}). Attempting OpenAI fallback...`, anthropicError);

      const fallbackResult = await tryOpenAIFallback(systemPrompt, userPrompt, processNumber);
      if (fallbackResult) {
        return new Response(JSON.stringify(fallbackResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return buildErrorResponse(anthropicStatus, anthropicError);
    }

    const aiResponse = await response!.json();
    const content = aiResponse.content?.[0]?.text;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('AI response:', content);

    const suggestion = parseAIResponse(content, processNumber);

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in suggest-task function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildFreeFormPrompt(taskTypesList: string): string {
  return `Você é um advogado processualista brasileiro sênior com 20 anos de experiência. O advogado está criando uma tarefa do zero e descreveu o que precisa fazer. Sua função é:

1. Refinar o título para ser claro e conciso (máx 80 caracteres)
2. Expandir a descrição com detalhes práticos e providências concretas
3. Sugerir a categoria mais adequada da lista
4. Sugerir prazo se aplicável
5. Avaliar urgência e importância

TIPOS DE TAREFA DISPONÍVEIS:
${taskTypesList}

Responda SEMPRE em formato JSON com esta estrutura EXATA:
{
  "suggestedTaskType": "nome do tipo de tarefa mais adequado da lista acima",
  "suggestedTaskTypeId": "id do tipo se disponível, ou null",
  "taskTitle": "título refinado, claro e conciso (máx 80 caracteres)",
  "taskDescription": "descrição detalhada com providências concretas",
  "suggestedDeadline": "data sugerida (formato YYYY-MM-DD) ou null",
  "isUrgent": true ou false,
  "isImportant": true ou false,
  "reasoning": "explicação de por que esta categorização e detalhamento foram sugeridos"
}`;
}

function buildMovementPrompt(taskTypesList: string): string {
  return `Você é um advogado processualista brasileiro sênior com 20 anos de experiência. Sua tarefa é analisar movimentações processuais e sugerir a PRÓXIMA AÇÃO CONCRETA que o advogado deve tomar.

REGRAS ABSOLUTAS:
1. A tarefa DEVE ser uma ação DIRETA e ESPECÍFICA em resposta ao conteúdo da movimentação
2. NUNCA sugira tarefas genéricas como "conferir publicações", "verificar andamento", "acompanhar processo" ou "monitorar publicações"
3. Se a movimentação indica uma AÇÃO FUTURA (julgamento, audiência, perícia), sugira PREPARAÇÃO para essa ação
4. Se a movimentação indica uma DECISÃO ou DESPACHO, sugira a resposta processual adequada
5. Seja ESPECÍFICO — mencione o tipo de peça, o prazo, a providência exata

EXEMPLOS DE MOVIMENTAÇÕES E TAREFAS CORRETAS:

JULGAMENTO:
- "Designado para julgamento virtual" → "Avaliar necessidade de oposição ao julgamento virtual e preparar sustentação oral"
- "Incluído em pauta de julgamento" → "Preparar memoriais e sustentação oral para julgamento"

SENTENÇA E DECISÕES:
- "Proferida sentença procedente" → "Analisar dispositivo da sentença e comunicar cliente sobre resultado favorável"
- "Proferida sentença improcedente" → "Analisar sentença para interposição de recurso de apelação"
- "Decisão monocrática — negado seguimento" → "Analisar cabimento de agravo interno contra decisão monocrática"
- "Decisão interlocutória — indeferido pedido de tutela" → "Avaliar interposição de agravo de instrumento"

INTIMAÇÕES:
- "Intimação para manifestação sobre laudo pericial" → "Analisar laudo pericial e elaborar manifestação técnica"
- "Intimação para contrarrazões de recurso" → "Elaborar contrarrazões ao recurso interposto"
- "Intimação para pagamento (art. 523 CPC)" → "Orientar cliente sobre pagamento voluntário ou elaborar impugnação"

CITAÇÃO:
- "Citação para contestar" → "Elaborar contestação no prazo legal"
- "Citação para audiência de conciliação" → "Preparar proposta de acordo e orientar cliente para audiência"

DESPACHOS:
- "Despacho: Diga a parte autora" → "Elaborar petição de manifestação conforme determinado"
- "Despacho: Emenda à inicial" → "Emendar petição inicial conforme determinação judicial"

AUDIÊNCIAS:
- "Designada audiência de instrução" → "Preparar rol de testemunhas, documentos e quesitos para audiência"
- "Designada audiência de conciliação" → "Preparar proposta de acordo e orientar cliente"

RECURSOS:
- "Certidão de publicação" → "Calcular prazo recursal e providenciar peça processual"
- "Recurso de apelação interposto pela parte contrária" → "Elaborar contrarrazões de apelação"

PERÍCIA:
- "Nomeado perito judicial" → "Indicar assistente técnico e elaborar quesitos"
- "Laudo pericial juntado" → "Analisar laudo pericial e elaborar parecer técnico divergente se necessário"

CUMPRIMENTO DE SENTENÇA:
- "Trânsito em julgado" → "Iniciar cumprimento de sentença ou verificar obrigação a cumprir"
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
}

function parseAIResponse(content: string, processNumber?: string) {
  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI response as JSON');
    return {
      suggestedTaskType: 'Análise de movimentação',
      suggestedTaskTypeId: null,
      taskTitle: `Analisar movimentação - ${processNumber || 'Processo'}`,
      taskDescription: 'Verificar e tomar providências sobre a movimentação recente do processo.',
      suggestedDeadline: null,
      isUrgent: false,
      isImportant: true,
      reasoning: 'Sugestão padrão - não foi possível analisar o conteúdo automaticamente.',
    };
  }
}

async function tryOpenAIFallback(systemPrompt: string, userPrompt: string, processNumber?: string) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) return null;

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

    if (!openaiResponse.ok) {
      console.error('OpenAI fallback also failed:', openaiResponse.status);
      return null;
    }

    console.log('OpenAI fallback succeeded');
    const openaiData = await openaiResponse.json();
    const fallbackContent = openaiData.choices?.[0]?.message?.content;
    if (fallbackContent) {
      return parseAIResponse(fallbackContent, processNumber);
    }
  } catch (err) {
    console.error('OpenAI fallback error:', err);
  }
  return null;
}

function buildErrorResponse(status: number, errorText: string) {
  const errorMap: Record<number, string> = {
    529: 'O serviço de IA está temporariamente sobrecarregado. Tente novamente em alguns segundos.',
    429: 'Limite de requisições excedido. Tente novamente em alguns segundos.',
    401: 'Erro de autenticação com a API.',
    402: 'A API de IA está sem créditos. Entre em contato com o administrador.',
  };

  let message = errorMap[status];
  if (!message && status === 400 && errorText.toLowerCase().includes('credit balance')) {
    message = errorMap[402];
  }
  if (!message) {
    try {
      message = JSON.parse(errorText)?.error?.message || `Erro da API (${status})`;
    } catch {
      message = `Erro da API (${status})`;
    }
  }

  return new Response(JSON.stringify({ error: message }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

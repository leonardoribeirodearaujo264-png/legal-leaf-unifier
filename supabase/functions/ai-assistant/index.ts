import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `Você é um assistente de IA útil e prestativo. Responda em português brasileiro de forma clara e profissional.
Se receber arquivos anexados, analise-os cuidadosamente.
Seja conciso mas completo em suas respostas.`;

// Models routed through Lovable Cloud gateway
const GATEWAY_MODELS: Record<string, string> = {
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-flash-lite': 'google/gemini-2.5-flash-lite',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gemini-3-pro': 'google/gemini-3.1-pro-preview',
  'lovable-gpt-5': 'openai/gpt-5',
  'lovable-gpt-5-mini': 'openai/gpt-5-mini',
  'lovable-gpt-5-nano': 'openai/gpt-5-nano',
};

// Models using OpenAI API key directly
const OPENAI_DIRECT_MODELS: Record<string, string> = {
  'gpt-5.2': 'gpt-5.2',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'openai-o3': 'o3',
  'openai-o4-mini': 'o4-mini',
};

// Perplexity models (direct API for web search)
const PERPLEXITY_MODELS: Record<string, string> = {
  'perplexity-small': 'sonar',
  'perplexity-large': 'sonar-pro',
  'perplexity-huge': 'sonar-reasoning',
};

// Claude models (direct Anthropic API)
const CLAUDE_MODELS: Record<string, string> = {
  'claude-sonnet': 'claude-sonnet-4-20250514',
  'claude-haiku': 'claude-haiku-4-20250414',
};

function formatMessages(messages: any[], attachments?: any[]) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m: any, index: number) => {
      if (index === messages.length - 1 && attachments && attachments.length > 0) {
        const attachmentInfo = attachments.map((a: any) => `[Arquivo anexado: ${a.name}]`).join('\n');
        return { role: m.role, content: `${m.content}\n\n${attachmentInfo}` };
      }
      return { role: m.role, content: m.content };
    })
  ];
}

function getModelType(model: string): 'gateway' | 'openai' | 'perplexity' | 'claude' | 'manus' {
  if (model === 'manus') return 'manus';
  if (model in CLAUDE_MODELS) return 'claude';
  if (model in PERPLEXITY_MODELS) return 'perplexity';
  if (model in OPENAI_DIRECT_MODELS) return 'openai';
  return 'gateway';
}

async function callGateway(messages: any[], model: string, stream: boolean = false) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

  const resolvedModel = GATEWAY_MODELS[model] || 'google/gemini-2.5-flash';
  console.log('Gateway request:', { requestedModel: model, resolvedModel, stream });

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: resolvedModel, messages, stream }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
    if (response.status === 402) throw new Error('Créditos insuficientes. Entre em contato com o administrador.');
    const errorText = await response.text();
    console.error('Gateway error:', response.status, errorText);
    throw new Error('Erro ao comunicar com a IA');
  }

  return response;
}

async function callOpenAIDirect(messages: any[], model: string, stream: boolean = false) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada. Configure nas configurações.');

  const resolvedModel = OPENAI_DIRECT_MODELS[model] || 'gpt-4o';
  console.log('OpenAI direct request:', { requestedModel: model, resolvedModel, stream });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: resolvedModel, messages, stream }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Limite de requisições OpenAI excedido. Tente novamente.');
    if (response.status === 402 || response.status === 401) throw new Error('Erro de autenticação/créditos OpenAI.');
    const errorText = await response.text();
    console.error('OpenAI error:', response.status, errorText);
    throw new Error('Erro ao comunicar com OpenAI');
  }

  return response;
}

async function callClaude(messages: any[], model: string, stream: boolean = false) {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada. Configure nas configurações.');

  const resolvedModel = CLAUDE_MODELS[model] || 'claude-sonnet-4-20250514';
  console.log('Claude request:', { requestedModel: model, resolvedModel, stream });

  // Anthropic uses a different message format: system is a top-level param
  const systemMsg = messages.find((m: any) => m.role === 'system')?.content || SYSTEM_PROMPT;
  const nonSystemMessages = messages.filter((m: any) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: 8192,
      system: systemMsg,
      messages: nonSystemMessages.map((m: any) => ({ role: m.role, content: m.content })),
      stream,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Limite de requisições Claude excedido. Tente novamente.');
    if (response.status === 401) throw new Error('Erro de autenticação Anthropic. Verifique a API key.');
    const errorText = await response.text();
    console.error('Claude error:', response.status, errorText);
    throw new Error('Erro ao comunicar com Claude');
  }

  return response;
}

function convertClaudeStreamToSSE(claudeBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = claudeBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'content_block_delta' && event.delta?.text) {
              const sseData = {
                choices: [{ delta: { content: event.delta.text } }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
            } else if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
          } catch { /* skip malformed */ }
        }
      }
    }
  });
}

async function callPerplexity(messages: any[], model: string, stream: boolean = false) {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY não configurada');

  const resolvedModel = PERPLEXITY_MODELS[model] || 'sonar-pro';

  const systemPrompt = `Você é um assistente de pesquisa especializado. Responda em português brasileiro.
Sempre cite suas fontes quando possível.
Forneça informações atualizadas e precisas.`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({ role: m.role, content: m.content }))
  ];

  console.log('Perplexity request:', { requestedModel: model, resolvedModel, stream });

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: formattedMessages,
      temperature: 0.2,
      ...(stream ? { stream: true } : { max_tokens: 4096 }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity error:', response.status, errorText);
    throw new Error('Erro ao comunicar com Perplexity');
  }

  return response;
}

async function callManus(messages: any[]) {
  const MANUS_API_KEY = Deno.env.get('MANUS_API_KEY');
  if (!MANUS_API_KEY) throw new Error('MANUS_API_KEY não configurada');

  const lastMessage = messages[messages.length - 1]?.content || '';

  const response = await fetch('https://api.manus.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MANUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: lastMessage,
      history: messages.slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Manus error:', response.status, errorText);
    throw new Error('Erro ao comunicar com Manus AI');
  }

  const data = await response.json();
  return { content: data.response || data.message || data.content || 'Sem resposta' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { messages, model, attachments, stream } = await req.json();

    if (!messages || messages.length === 0) {
      throw new Error('Mensagens são obrigatórias');
    }

    const modelType = getModelType(model);
    const formattedMessages = formatMessages(messages, attachments);

    // Streaming
    if (stream) {
      let response: Response;

      if (modelType === 'claude') {
        response = await callClaude(formattedMessages, model, true);
        // Convert Claude SSE format to OpenAI-compatible SSE
        const convertedStream = convertClaudeStreamToSSE(response.body!);
        return new Response(convertedStream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      } else if (modelType === 'perplexity') {
        response = await callPerplexity(messages, model, true);
      } else if (modelType === 'openai') {
        response = await callOpenAIDirect(formattedMessages, model, true);
      } else {
        response = await callGateway(formattedMessages, model, true);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // Non-streaming
    let result: { content: string; images?: string[] };

    if (modelType === 'manus') {
      result = await callManus(messages);
    } else if (modelType === 'claude') {
      const response = await callClaude(formattedMessages, model);
      const data = await response.json();
      result = { content: data.content?.[0]?.text || 'Sem resposta' };
    } else if (modelType === 'perplexity') {
      const response = await callPerplexity(messages, model);
      const data = await response.json();
      result = { content: data.choices?.[0]?.message?.content || 'Sem resposta' };
    } else if (modelType === 'openai') {
      const response = await callOpenAIDirect(formattedMessages, model);
      const data = await response.json();
      result = { content: data.choices?.[0]?.message?.content || 'Sem resposta' };
    } else {
      const response = await callGateway(formattedMessages, model);
      const data = await response.json();
      result = { content: data.choices?.[0]?.message?.content || 'Sem resposta' };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('AI Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({
      error: errorMessage,
      content: `Desculpe, ocorreu um erro: ${errorMessage}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

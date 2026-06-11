import { AI_PROVIDER_MAP, CLAUDE_MODEL_MAP, PERPLEXITY_MODEL_MAP, OPENAI_MODEL_MAP, GEMINI_MODEL_MAP } from '@/config/ai';
import { streamClaude } from './claudeService';
import { streamPerplexity } from './perplexityService';
import { streamGemini } from './geminiService';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface StreamOptions {
  enableSearch?: boolean;
  enableImageGen?: boolean;
  attachments?: { name: string; type: string; content: string }[];
  signal?: AbortSignal;
}

export async function streamAI(
  messages: ChatMessage[],
  modelId: string,
  onDelta: (text: string) => void,
  options: StreamOptions = {}
): Promise<void> {
  const provider = AI_PROVIDER_MAP[modelId] ?? 'gemini';

  if (provider === 'gemini') {
    const geminiModel = GEMINI_MODEL_MAP[modelId] ?? 'gemini-2.5-flash';
    return streamGemini(messages, geminiModel, onDelta, options.signal);
  }

  if (provider === 'claude') {
    const claudeModel = CLAUDE_MODEL_MAP[modelId] ?? 'claude-sonnet-4-6';
    return streamClaude(messages, claudeModel, onDelta, options.signal);
  }

  if (provider === 'perplexity') {
    const perplexityModel = PERPLEXITY_MODEL_MAP[modelId] ?? 'sonar-pro';
    return streamPerplexity(messages, perplexityModel, onDelta, options.signal);
  }

  // openai (default fallback)
  return streamOpenAIDirect(messages, modelId, onDelta, options.signal);
}

async function streamOpenAIDirect(
  messages: ChatMessage[],
  modelId: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;
  if (!apiKey) throw new Error('OpenAI API key não configurada. Adicione VITE_OPENAI_API_KEY ao .env');

  const model = OPENAI_MODEL_MAP[modelId] ?? 'gpt-4o';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, stream: true, messages }),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Erro OpenAI HTTP ${response.status}`);
  }

  await consumeSSE(response.body, (parsed) => {
    const choices = parsed.choices as { delta?: { content?: string } }[] | undefined;
    const text = choices?.[0]?.delta?.content;
    if (text) onDelta(text);
  });
}

async function consumeSSE(
  body: ReadableStream<Uint8Array>,
  onChunk: (parsed: Record<string, unknown>) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (!json || json === '[DONE]') continue;
      try {
        onChunk(JSON.parse(json) as Record<string, unknown>);
      } catch { /* ignore malformed SSE lines */ }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (!json || json === '[DONE]') continue;
      try {
        onChunk(JSON.parse(json) as Record<string, unknown>);
      } catch { /* ignore */ }
    }
  }
}

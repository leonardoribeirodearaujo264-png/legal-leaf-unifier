const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Perplexity requires: optional system messages first, then strictly alternating
 * user → assistant → user → … This sanitizer merges consecutive same-role messages
 * so the array is always valid even if the caller built it differently.
 */
function sanitizeForPerplexity(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push(msg);
      continue;
    }
    const lastNonSystem = [...result].reverse().find(m => m.role !== 'system');
    if (!lastNonSystem || lastNonSystem.role !== msg.role) {
      result.push({ ...msg });
    } else {
      // Merge consecutive same-role messages into one
      const idx = result.lastIndexOf(lastNonSystem);
      result[idx] = { ...result[idx], content: `${result[idx].content}\n\n${msg.content}` };
    }
  }
  // Perplexity must start with a user message after system messages
  const firstNonSystem = result.find(m => m.role !== 'system');
  if (firstNonSystem && firstNonSystem.role !== 'user') {
    const idx = result.indexOf(firstNonSystem);
    result.splice(idx, 1);
  }
  return result;
}

export async function streamPerplexity(
  messages: ChatMessage[],
  model: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('Perplexity API key não configurada. Adicione VITE_PERPLEXITY_API_KEY ao .env');

  const sanitized = sanitizeForPerplexity(messages);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, stream: true, messages: sanitized }),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Erro Perplexity HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
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
        const parsed = JSON.parse(json) as { choices?: { delta?: { content?: string } }[] };
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) onDelta(text);
      } catch { /* ignore malformed SSE lines */ }
    }
  }
}

export async function searchJurisprudencia(query: string): Promise<string> {
  const apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('Perplexity API key não configurada');

  const systemPrompt = `Você é um especialista em jurisprudência brasileira. Ao receber uma consulta jurídica,
busque decisões relevantes dos tribunais superiores (STF, STJ, TST, TRF) e tribunais estaduais.
Responda em formato estruturado com: tribunal, número do processo, relator, data, ementa e resumo da decisão.
Sempre cite as fontes e links quando disponíveis.`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message || 'Erro ao consultar jurisprudência');
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

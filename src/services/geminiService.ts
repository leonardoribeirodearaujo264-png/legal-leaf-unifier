// Google Gemini via endpoint compatível com OpenAI
// Docs: https://ai.google.dev/gemini-api/docs/openai
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

export interface ChatMessage {
  role: string;
  content: string;
}

export async function streamGemini(
  messages: ChatMessage[],
  model: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!apiKey) throw new Error('Gemini API key não configurada. Adicione VITE_GEMINI_API_KEY ao .env');

  const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Erro Gemini HTTP ${response.status}`);
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

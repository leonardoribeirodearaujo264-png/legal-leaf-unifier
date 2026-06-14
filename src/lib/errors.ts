/**
 * Converts raw API/technical errors into user-friendly Portuguese messages.
 * No internal API details, endpoint names, or stack traces reach the UI.
 */
export function friendlyAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  // Billing / quota
  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient_quota') || lower.includes('exceeded your current quota')) {
    return 'O modelo de IA selecionado está temporariamente indisponível. Tente outro modelo ou volte mais tarde.';
  }
  // Rate limit
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'Muitas requisições ao assistente de IA. Aguarde alguns segundos e tente novamente.';
  }
  // Authentication / key issues
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('api key') || lower.includes('authentication')) {
    return 'O assistente de IA não está disponível no momento. Entre em contato com o suporte.';
  }
  // Perplexity alternating messages
  if (lower.includes('alternate') || lower.includes('should alternate') || lower.includes('system message')) {
    return 'Erro na sessão do assistente. Inicie uma nova conversa.';
  }
  // Network / fetch
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch')) {
    return 'Sem conexão com o servidor de IA. Verifique sua internet e tente novamente.';
  }
  // Timeout
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return 'O assistente demorou demais para responder. Tente novamente.';
  }
  // JSON / parse issues from AI response
  if (lower.includes('json') || lower.includes('parse') || lower.includes('valid')) {
    return 'O assistente retornou uma resposta inválida. Tente novamente.';
  }
  // Generic fallback — never show raw technical message
  return 'O assistente de IA não conseguiu responder. Tente novamente ou escolha outro modelo.';
}

/** User-friendly version of DataJud/search errors. */
export function friendlyDatajudError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('não configurada') || lower.includes('api_key') || lower.includes('401') || lower.includes('403')) {
    return 'Serviço de busca de processos indisponível. Entre em contato com o suporte.';
  }
  if (lower.includes('timeout') || lower.includes('28s') || lower.includes('lento')) {
    return 'A busca demorou demais. Tente novamente em alguns instantes.';
  }
  if (lower.includes('não encontrado')) {
    return raw; // this is already user-friendly
  }
  if (lower.includes('inválido') || lower.includes('formato')) {
    return raw; // format errors are already user-friendly
  }
  return 'Não foi possível buscar o processo. Verifique o número e tente novamente.';
}

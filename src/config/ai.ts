export type AIProvider = 'gemini' | 'claude' | 'openai' | 'perplexity';

export const AI_PROVIDER_MAP: Record<string, AIProvider> = {
  // Gemini — chamada direta à API do Google
  'gemini-flash': 'gemini',
  'gemini-flash-lite': 'gemini',
  'gemini-pro': 'gemini',
  'gemini-3-pro': 'gemini',
  // OpenAI direto
  'gpt-5.2': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'openai-o3': 'openai',
  'openai-o4-mini': 'openai',
  // Perplexity direto
  'perplexity-small': 'perplexity',
  'perplexity-large': 'perplexity',
  'perplexity-huge': 'perplexity',
  // Claude direto
  'claude-sonnet': 'claude',
  'claude-haiku': 'claude',
  // Manus — fallback para gemini
  'manus': 'gemini',
};

// IDs reais na API do Gemini (endpoint compatível com OpenAI)
export const GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-flash-lite': 'gemini-2.5-flash-lite-preview-06-17',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-3-pro': 'gemini-2.5-pro',
  'manus': 'gemini-2.5-flash',
};

export const OPENAI_MODEL_MAP: Record<string, string> = {
  'gpt-5.2': 'gpt-4o',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'openai-o3': 'o3-mini',
  'openai-o4-mini': 'o4-mini',
};

export const CLAUDE_MODEL_MAP: Record<string, string> = {
  'claude-sonnet': 'claude-sonnet-4-6',
  'claude-haiku': 'claude-haiku-4-5-20251001',
};

export const PERPLEXITY_MODEL_MAP: Record<string, string> = {
  'perplexity-small': 'sonar',
  'perplexity-large': 'sonar-pro',
  'perplexity-huge': 'sonar-reasoning-pro',
};

export const DEFAULT_AI_MODEL = import.meta.env.VITE_DEFAULT_AI_MODEL || 'gemini-flash';

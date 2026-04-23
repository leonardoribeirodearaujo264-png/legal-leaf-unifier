

## Corrigir "Não autorizado" no Assistente de IA

### Causa raiz (confirmada)

No commit `aee4b36` adicionei `requireUser()` em 18 edge functions de IA. Esse helper chama `supabase.auth.getUser(token)` para validar que o token é de um **usuário real** (não a anon key pública).

O `Assistente IA` (`/assistente-ia`) usa **streaming**, e streaming é a única chamada de IA do projeto que **não** usa `supabase.functions.invoke()` — usa `fetch()` direto, em `src/pages/AssistenteIA.tsx` linha 616-630. O Authorization header está enviando a `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) em vez do JWT do usuário logado:

```ts
'Authorization': `Bearer ${SUPABASE_KEY}`,  // ← anon key, não JWT
```

A anon key não corresponde a nenhum usuário, então `getUser()` falha e retorna 401 "Não autorizado". Isso quebra **toda** mensagem do Assistente IA (com ou sem anexo) para todos os colaboradores. Anexo dá o mesmo erro porque vai pelo mesmo `streamChat`.

Demais funções de IA chamadas no projeto (`voice-to-text`, `suggest-petition`, `chat-with-agent` etc.) já usam `supabase.functions.invoke()`, que injeta o JWT do usuário automaticamente, então funcionam.

### Correção

**Único arquivo:** `src/pages/AssistenteIA.tsx` (função `streamChat`, ~linha 604-630)

Trocar o header `Authorization` para enviar o JWT do usuário, obtido via `supabase.auth.getSession()`:

```ts
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
if (!token) throw new Error('Sessão expirada. Faça login novamente.');

const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,        // JWT do usuário
    'apikey': SUPABASE_KEY,                    // anon key como apikey (necessária pelo gateway)
  },
  body: JSON.stringify({ ... }),
  signal: abortControllerRef.current.signal
});
```

Isso é exatamente o que `supabase.functions.invoke()` faz por baixo dos panos. Com o JWT real, `requireUser()` na edge function valida o usuário e libera o acesso para qualquer colaborador autenticado e aprovado.

### Validação após o deploy

1. Mariana (ou qualquer colaborador aprovado) abre `/assistente-ia`, manda uma mensagem simples → resposta volta normal.
2. Anexa um PDF/imagem + manda mensagem → resposta volta normal.
3. Continua funcionando para todos os modelos (Gemini, GPT, Claude, Perplexity, Manus) — todos passam pelo mesmo `streamChat`.

### Não muda

- Edge function `ai-assistant` continua exigindo JWT válido (segurança intacta — o finding `unauth_ai_functions` que acabamos de fechar **continua resolvido**).
- Modo non-streaming (`supabase.functions.invoke('ai-assistant', ...)` usado em `ContractGenerator` e `ProcuracaoGenerator`) já funciona — não toca.
- Outras funções de IA (`voice-to-text`, `suggest-task` etc.) — não toca.
- Banco, RLS, helper `_shared/auth.ts` — não toca.

### Risco

Zero. É **literalmente** trocar uma string no header. O padrão usado depois é o mesmo que o resto do app já faz via `functions.invoke()`. Se o usuário não tiver sessão ativa (token expirado), em vez de cair com "Não autorizado" da edge function, mostramos uma mensagem clara pedindo para refazer login — comportamento melhor que o atual.




## Corrigir erro "Sugerir Tarefa com IA" nas movimentações

### Diagnóstico

O erro que aparece na tela é **"Edge Function returned a non-2xx status code"** — uma mensagem genérica do SDK do Supabase.

Nos logs da edge function, o erro real é:
```
Anthropic API error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}
```

A API da Anthropic retornou **529 (Overloaded)** — os servidores do Claude estão sobrecarregados. O código atual não trata esse status e cai no handler genérico que retorna status 500, fazendo o SDK do Supabase engolir a mensagem real.

### O que vou fazer

**1. Adicionar retry automático com backoff para erros 529 (Overloaded)**
- Se a Anthropic retornar 529, a função tenta novamente até 2 vezes com espera de 2s e 4s.
- Isso resolve a maioria dos casos de sobrecarga temporária sem intervenção do usuário.

**2. Tratar o erro 529 explicitamente**
- Se após os retries ainda falhar, retornar uma mensagem clara: "O serviço de IA está temporariamente sobrecarregado. Tente novamente em alguns segundos."

**3. Melhorar o tratamento de erro no frontend**
- No `TaskCreationForm.tsx`, quando `supabase.functions.invoke` retorna erro, extrair a mensagem do `data` (que contém o JSON de erro) em vez de mostrar a mensagem genérica do SDK.

### Arquivos que serão alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/suggest-task/index.ts` | Adicionar retry com backoff para 529 + tratar erro explicitamente |
| `src/components/TaskCreationForm.tsx` | Melhorar extração da mensagem de erro real |

### Sem alteração no banco de dados


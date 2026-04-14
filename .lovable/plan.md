

## Corrigir "Analisar com IA" no Meta Ads (página em branco)

### Causa raiz
A edge function `meta-ads-ai-analysis` usa `supabase.auth.getClaims(token)` — esse método **não existe** no Supabase JS client. Isso causa um erro no runtime da função, que retorna um erro 500 ou crash silencioso. No frontend, o erro não é tratado de forma que impeça a renderização, causando a tela em branco.

### Correção

**`supabase/functions/meta-ads-ai-analysis/index.ts`**:
- Substituir `supabase.auth.getClaims(token)` por `supabase.auth.getUser()`, que é o método correto para validar autenticação
- Extrair o `user.id` para usar ao salvar a análise no banco
- Manter toda a lógica restante (chamada ao Anthropic, salvamento no histórico)

Trecho da correção:
```typescript
// ANTES (não funciona):
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { return 401 }
// user_id: claimsData.claims.sub

// DEPOIS:
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) { return 401 }
// user_id: user.id
```

Essa é uma correção pontual em um arquivo — nenhuma mudança necessária no frontend.


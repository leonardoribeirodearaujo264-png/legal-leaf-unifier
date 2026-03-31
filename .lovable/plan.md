

## Corrigir acesso de Letícia (admin) à folha de pagamento

### Causa raiz

No arquivo `src/pages/RH.tsx`, linha 14, o hook `useUserRole()` é chamado mas o campo `loading` **não é verificado**. O código pula direto para o check de permissão na linha 25:

```typescript
const { isAdmin, profile } = useUserRole(); // ← não pega 'loading'
// ...
if (!canAccess && !isSelfProfile) { // ← roda antes do role carregar
  return <Acesso Restrito />;
}
```

Enquanto a query de role está em andamento, `isAdmin` é `false` (valor inicial). O resultado é que a tela "Acesso Restrito" aparece permanentemente — a página nunca re-renderiza porque `loading` não é observado.

Letícia **é admin** no banco de dados (confirmado). O problema é puramente de timing no frontend.

### Correção

**Arquivo: `src/pages/RH.tsx`**

1. Extrair `loading` do `useUserRole()` na linha 14
2. Adicionar check de loading antes do check de permissão — mostrar spinner enquanto carrega

```typescript
const { isAdmin, profile, loading } = useUserRole();

if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Carregando...</div>
    </div>
  );
}
```

Apenas essas 2 alterações no mesmo arquivo. Nenhuma outra mudança necessária.

### Resultado
- Letícia (e qualquer admin) verá um spinner rápido enquanto o role carrega, depois acessa normalmente a folha de pagamento
- Nenhum dado ou RLS foi alterado — o problema nunca foi de permissão real


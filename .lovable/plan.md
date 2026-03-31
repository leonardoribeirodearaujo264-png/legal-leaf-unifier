

## Filtrar colaboradores inativos do painel "Quem não está no escritório hoje"

### Problema

Na função `fetchAbsences()` do Dashboard (linha 164), ao buscar os perfis dos ausentes, a query não filtra por `is_active` e `is_suspended`. Isso faz com que a Tatiane (desligada) apareça no painel se ainda tiver registros antigos de home office, folga ou férias.

### Correção

**Arquivo: `src/pages/Dashboard.tsx` (linha 164-167)**

Adicionar filtros `.eq('is_active', true).eq('is_suspended', false)` na query de profiles dentro de `fetchAbsences`:

```typescript
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name, avatar_url')
  .in('id', Array.from(absenceMap.keys()))
  .eq('is_active', true)
  .eq('is_suspended', false);
```

Apenas essa alteração. Nenhum outro arquivo precisa ser modificado.


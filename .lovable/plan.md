

## Zerar tarefas pendentes no CRM para refletir o RD Station

### Problema

A migração anterior corrigiu 6.267 tarefas que tinham `completed=true` mas `status='pending'`. Porém, restam **283 tarefas** com `completed=false` e `status='pending'`. Como você confirmou que o RD Station tem zero tarefas pendentes, essas 283 precisam ser marcadas como concluídas também.

**Causa raiz da recorrência**: A função de sincronização (`crm-sync`) não inclui o campo `status` no upsert (linhas 1062-1074). Ela só define `completed: task.done === true`, mas nunca define `status`. Quando o banco recebe o registro sem `status`, ele usa o valor padrão `'pending'` — criando inconsistência novamente a cada sync.

### Correção (2 partes)

**1. Migração SQL — Marcar as 283 tarefas restantes como concluídas**

```sql
UPDATE crm_activities 
SET status = 'completed',
    completed = true,
    completed_at = COALESCE(completed_at, updated_at, created_at)
WHERE status = 'pending' AND (completed = false OR completed IS NULL);
```

**2. Edge Function `crm-sync/index.ts` — Incluir `status` no mapeamento de tarefas**

Na função `syncActivities`, adicionar o campo `status` ao objeto retornado no `.map()` (após a linha 1071):

```typescript
return {
  rd_station_id: task._id,
  // ... campos existentes ...
  completed: task.done === true,
  completed_at: task.done_date || null,
  status: task.done === true ? 'completed' : 'pending',  // NOVO
  created_at: task.created_at || new Date().toISOString()
};
```

Isso garante que futuras sincronizações definam `status` corretamente, mantendo consistência entre `completed` e `status`.

### Resultado esperado
- Card "Atrasadas" e "Pendentes" ficarão zerados, refletindo o RD Station
- Futuras sincronizações manterão `status` e `completed` sempre consistentes


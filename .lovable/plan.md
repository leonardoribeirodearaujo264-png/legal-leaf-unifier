

## Corrigir contagem incorreta de tarefas atrasadas no CRM

### Causa raiz

Há **6.267 tarefas** no banco com dados inconsistentes: `completed = true` mas `status = 'pending'`. Isso acontece porque a sincronização com o RD Station marca `completed = true` quando a tarefa é concluída lá, mas não atualiza o campo `status` para `'completed'`.

A função `getTaskStatus()` no frontend prioriza o campo `status` sobre `completed`:
```typescript
const getTaskStatus = (a: Activity): TaskStatus => {
  return ((a as any).status as TaskStatus) || (a.completed ? 'completed' : 'pending');
};
```

Como `status = 'pending'` é um valor truthy, ele é retornado diretamente — ignorando que `completed = true`. Resultado: tarefas já concluídas no RD Station aparecem como "pendentes e atrasadas" na Intranet.

**Dados reais do banco:**
| status | completed | quantidade |
|--------|-----------|------------|
| pending | true | **6.267** ← o problema |
| pending | false | 283 |
| completed | true | 123 |

### Correção (2 partes)

**1. Migração SQL — Corrigir dados existentes**

Atualizar as 6.267 linhas inconsistentes para `status = 'completed'`:
```sql
UPDATE crm_activities 
SET status = 'completed', 
    completed_at = COALESCE(completed_at, updated_at, created_at)
WHERE completed = true AND (status IS NULL OR status = 'pending');
```

**2. Frontend — Corrigir `getTaskStatus()` em `CRMTasks.tsx`**

Alterar a lógica para que `completed = true` sempre retorne `'completed'`, independente do valor de `status`:
```typescript
const getTaskStatus = (a: Activity): TaskStatus => {
  if (a.completed) return 'completed';
  return ((a as any).status as TaskStatus) || 'pending';
};
```

Isso garante que mesmo que futuras sincronizações tragam a mesma inconsistência, o frontend tratará corretamente.

### Resultado esperado
- Card "Atrasadas" cairá de ~891 para o número real (~283 ou menos)
- Dados ficarão consistentes com o que o RD Station mostra
- Proteção contra futuras inconsistências de sincronização


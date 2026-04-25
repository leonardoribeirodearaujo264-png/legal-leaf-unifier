## Otimização da aba Tarefas (ADVBox) — corrigir lentidão

### Causa raiz (confirmada)

A página `src/pages/TarefasAdvbox.tsx` carrega **todas** as ~13k tarefas via loop em batches de 1000 antes de paginar no cliente. O payload pesa ~17 MB porque inclui o JSONB `raw_data` em cada linha, sendo que ele só é usado para extrair o nome do cliente. Além disso, faz duas chamadas a edge functions ADVBox no `useEffect` inicial (`fetchAdvboxTaskTypes`, `fetchAdvboxUsers`) que só são necessárias ao abrir o diálogo "Nova tarefa".

### Mudanças

**1. Migração de schema**
- Adicionar coluna `client_name TEXT` em `advbox_tasks`.
- Criar índices: `idx_advbox_tasks_status_due_date`, `idx_advbox_tasks_client_name_trgm` (pg_trgm para busca), `idx_advbox_tasks_assigned_users_trgm`.
- Backfill: `UPDATE advbox_tasks SET client_name = COALESCE(raw_data #>> '{lawsuit,customers,0,name}', raw_data #>> '{lawsuit,customers,name}')`.

**2. Edge function `sync-advbox-tasks`**
- Popular `client_name` no upsert a partir de `task.lawsuit?.customers`.

**3. Refatorar `src/pages/TarefasAdvbox.tsx`**
- Substituir o `while` que busca tudo por `.range(from, to)` (50 itens/página).
- Aplicar filtros (status, vendedor, datas, busca) **direto no Supabase** com `.eq`, `.gte`, `.lte`, `.ilike`.
- **Não selecionar `raw_data`** na listagem — apenas `id, advbox_id, title, due_date, status, assigned_users, client_name, completed_at, points, lawsuit_id, process_number`.
- Carregar `raw_data` sob demanda (apenas ao abrir detalhes da tarefa).
- React Query com `staleTime: 60_000` e `keepPreviousData` para troca de página suave.
- Skeleton durante load.

**4. Lazy load do diálogo "Nova tarefa"**
- Mover `fetchAdvboxTaskTypes` e `fetchAdvboxUsers` do `useEffect` inicial para dentro do handler de abertura do diálogo (com cache local em ref para não refetchar).

**5. Documentação**
- Atualizar `mem://integrations/latencia-e-persistencia-api-advbox` com a nova estratégia de paginação server-side.

### Não muda
- Permissões/RLS.
- Cron de sincronização (frequência e janelas).
- UI de criação/edição de tarefas.
- Lógica de status (pending/completed/stale).

### Risco
Baixo. A paginação server-side é padrão (já em uso para `advbox_customers`, ver memória `dataset-pagination-requirements`). Backfill de `client_name` é idempotente e não-destrutivo.

### Validação
1. Abrir `/tarefas-advbox` e medir tempo até primeiros itens visíveis (esperado: < 1s vs ~10–20s atual).
2. Aplicar filtros e confirmar que a query no Network mostra `range` e `eq`/`ilike` em vez de payload de 17 MB.
3. Trocar páginas e confirmar que cada request traz só 50 linhas leves.
4. Abrir "Nova tarefa" e confirmar que só agora as edge functions de tipos/usuários disparam.
5. Conferir `client_name` populado em amostras (`SELECT client_name FROM advbox_tasks LIMIT 20`).



## Reconciliar status de tarefas ADVBox: eliminar tarefas "fantasma"

### Causa raiz (confirmada por dados do DB)

A API `/posts` do ADVBox retorna **apenas as tarefas atualmente pendentes** (~1.432 hoje). Quando uma tarefa é concluída ou excluída no ADVBox, ela **some da resposta da API** — não vem mais com status "completed", simplesmente desaparece.

O sync atual (`sync-advbox-tasks`) usa `upsert` por `advbox_id`: ele só **adiciona/atualiza** o que vem da API. **Nunca marca como completed o que sumiu.** Resultado:

- DB tem **12.291 tarefas "pending"** acumuladas desde fev/2026.
- Apenas **1.295** foram tocadas no último sync (24h).
- **10.399 tarefas "fantasma"** — foram concluídas no ADVBox mas continuam aparecendo como pending na intranet.
- Mariana: **4.109 tarefas "pending"** na intranet, ~3.551 antigas (provavelmente já concluídas no ADVBox).

### Correção: marcar tarefas que sumiram da API como `completed`

Adicionar uma etapa de **reconciliação** no fim do sync `full`:

1. Antes de começar o sync, registrar `started_at` (já existe).
2. Coletar `Set<advbox_id>` de **todas as tarefas vistas nesta rodada** (já temos em `allTasks`).
3. Após upsert, executar **uma query de reconciliação**:

```sql
UPDATE advbox_tasks
SET status = 'completed',
    completed_at = COALESCE(completed_at, NOW()),
    synced_at = NOW()
WHERE status IN ('pending', 'in_progress', 'pendente')
  AND advbox_id NOT IN (<lista de IDs vistos>)
  AND synced_at < <started_at do sync atual>
```

A condição `synced_at < started_at` garante que só mexemos em tarefas que **deveriam ter sido tocadas se ainda existissem**, sem afetar tarefas recém-criadas durante o sync.

4. **Salvaguardas para evitar reconciliação destrutiva acidental**:
   - Só rodar reconciliação se `sync_type = 'full'` (não em parciais/incrementais).
   - Só rodar se `iterations >= esperado` (sync foi até o fim sem rate-limit fatal).
   - Só rodar se `allTasks.length >= 0.8 * totalCount` (recebeu ao menos 80% do esperado — evita marcar tudo como completed se a API caiu no meio).
   - Logar quantas tarefas foram reconciliadas em `advbox_tasks_sync_status.last_error` (campo livre) ou criar coluna nova `reconciled_count`.

### Limpeza única do legado (one-shot)

Como já temos ~10.399 tarefas fantasma acumuladas há meses, executar **uma vez** uma migração SQL que marca como `completed` tudo que tem `synced_at` "muito antigo" comparado ao último sync bem-sucedido:

```sql
UPDATE advbox_tasks
SET status = 'completed',
    completed_at = COALESCE(completed_at, synced_at),
    synced_at = NOW()
WHERE status IN ('pending', 'in_progress', 'pendente')
  AND synced_at < (
    SELECT MAX(started_at) - INTERVAL '6 hours'
    FROM advbox_tasks_sync_status
    WHERE status = 'completed'
  );
```

**Critério `< MAX(started_at) - 6h`**: dá margem de 6h para syncs lentos. Qualquer tarefa que não foi tocada por nenhum sync nas últimas 6h **necessariamente** sumiu da API → foi concluída/excluída no ADVBox.

Estimativa de impacto: ~10.399 tarefas Mariana e equipe deixam de aparecer como atrasadas. Sem risco de marcar como completed nenhuma tarefa real (a sync roda a cada 15min — qualquer tarefa ativa foi tocada na última hora).

### Mudanças complementares (UX)

Em **`/distribuicao-tarefas`** e dashboards de RH, exibir um **rodapé indicador**:

> "Última sincronização ADVBox: há X minutos. Y tarefas pendentes."

Isso ajuda a identificar problemas futuros se o sync falhar.

### Detalhes técnicos

**Arquivos modificados:**

1. **`supabase/functions/sync-advbox-tasks/index.ts`** — adicionar bloco de reconciliação após upsert final, com salvaguardas (sync_type=full, ≥80% recebido, sem erro). Salvar `reconciled_count` no log de sync.

2. **Nova migration SQL** (`supabase/migrations/<timestamp>_reconcile_advbox_tasks.sql`):
   - Adiciona coluna `reconciled_count INTEGER DEFAULT 0` em `advbox_tasks_sync_status`.
   - Executa o UPDATE one-shot acima para limpar legado (~10k registros).
   - Cria índice em `advbox_tasks(status, synced_at)` para acelerar a query de reconciliação futura (já existe um índice em `status` mas o composto ajuda).

3. **`src/pages/DistribuicaoTarefas.tsx`** e **`src/components/rh/RHColaboradorDashboard.tsx`** — adicionar pequeno texto no header com "Última sync: há Xmin" lendo de `advbox_tasks_sync_status` (1 linha de UI).

### Não muda

- Lógica de `determineStatus` para tarefas que **vêm** da API (continua igual: completed se API confirma, stale se >90 dias).
- Schema de `advbox_tasks` (apenas marca registros como `completed`).
- Ranking, exportação, criação de tarefa — nada.
- `ControlePrazos`, `RelatoriosProdutividadeTarefas`, `TarefasAdvbox` — funcionam imediatamente melhor sem mudanças, porque vão filtrar `status=pending` que agora reflete a realidade.

### Risco

**Baixíssimo.** O critério "synced_at < último_sync - 6h" é matematicamente seguro: se o cron rodou nas últimas 6h e a tarefa não foi tocada, ela **não está mais na API**. A única forma de marcar errado seria o sync falhar silenciosamente por mais de 6h — caso em que o próprio `last_error` capturaria.

A reconciliação automática só roda quando o sync recebe ≥80% do esperado, então uma queda parcial da API não dispara falsa reconciliação.


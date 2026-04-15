

## Melhorias na Integração ADVBox (API v1.2.0)

Baseado na análise completa da documentação atualizada da API e do código atual, estas são todas as melhorias possíveis organizadas em etapas.

### Resumo das Melhorias

| # | Melhoria | Impacto | Arquivo |
|---|----------|---------|---------|
| 1 | Cache persistente do `/settings` | Alto | `advbox-integration/index.ts` + migração |
| 2 | Criar tarefas no ADVBox (`POST /posts`) | Alto | `advbox-integration/index.ts` + `TarefasAdvbox.tsx` |
| 3 | Corrigir `rdstation-webhook` (endpoint errado) | Médio | `rdstation-webhook/index.ts` |
| 4 | Atualizar processos (`PUT /lawsuits/{id}`) | Médio | `advbox-integration/index.ts` |
| 5 | Atualizar transações (`PUT /transactions/{id}`) | Médio | `advbox-integration/index.ts` |
| 6 | Criar movimentações manuais (`POST /lawsuits/movement`) | Médio | `advbox-integration/index.ts` |
| 7 | Criar transações financeiras (`POST /transactions`) | Médio | `advbox-integration/index.ts` |
| 8 | Filtros avançados de movimentações (date_start/date_end) | Baixo | `advbox-integration/index.ts` |
| 9 | Ajuste de rate limit (2s entre GETs) | Baixo | `advbox-integration/index.ts` |
| 10 | Histórico de tarefas por processo (`GET /history/{id}`) | Baixo | `advbox-integration/index.ts` |
| 11 | Corrigir mapeamento de campos no `create-customer` | Baixo | `advbox-integration/index.ts` |

---

### Detalhamento Técnico

**1. Cache persistente do `/settings`**
- Criar tabela `advbox_settings_cache` (JSONB) para armazenar users, origins, tasks, stages, type_lawsuits e financial
- Na edge function, ao chamar `GET /settings`, salvar resultado no banco com TTL de 24h
- Usar esses IDs cached ao criar tarefas, processos e transações (evita chamadas extras)

**2. Criar tarefas no ADVBox (`POST /posts`)**
- Novo case `create-task` na edge function
- Campos obrigatórios: `from` (user ADVBox ID), `guests` (array IDs), `tasks_id`, `lawsuits_id`, `start_date`
- Campos opcionais: `start_time`, `end_date`, `end_time`, `date_deadline`, `local`, `comments`, `urgent`, `important`
- Buscar IDs de referência do cache de `/settings`
- No frontend (`TarefasAdvbox.tsx`), o dialog de criação de tarefas passa a enviar para a API ADVBox em vez de criar apenas localmente

**3. Corrigir `rdstation-webhook`**
- Linha que faz `POST /tarefas` precisa mudar para `POST /posts` com o body correto:
  ```
  { from: userId, guests: [marianaId], tasks_id, lawsuits_id, start_date }
  ```
- Buscar IDs de referência do settings cache

**4. Atualizar processos (`PUT /lawsuits/{id}`)**
- Novo case `update-lawsuit` para alterar fase (`stages_id`), responsável, honorários, datas de encerramento, etc.
- Permite mudar fase processual diretamente pela intranet

**5. Atualizar transações (`PUT /transactions/{id}`)**
- Novo case `update-transaction` para marcar como paga (`date_payment`), alterar valor, vencimento, descrição
- 7 campos alteráveis confirmados pela API

**6. Criar movimentações manuais**
- Novo case `create-movement` usando `POST /lawsuits/movement`
- Campos: `lawsuit_id`, `date` (DD/MM/YYYY), `description` (min 10 chars)

**7. Criar transações financeiras**
- Novo case `create-transaction` usando `POST /transactions`
- Requer IDs do settings cache: `debit_account`, `categories_id`, `cost_centers_id`

**8. Filtros avançados de movimentações**
- O endpoint `GET /last_movements` agora aceita `date_start` e `date_end`
- Usar esses filtros server-side em vez de buscar tudo e filtrar client-side (caso `lawsuits-recent`)

**9. Ajuste de rate limit**
- API permite 30 GETs/min = 1 a cada 2s
- Ajustar `DELAY_BETWEEN_REQUESTS` padrão de 1.5s para 2s
- Reduzir batches paralelos de 5 para 3 no `movements-full`

**10. Histórico de tarefas por processo**
- Novo case `task-history` usando `GET /history/{lawsuit_id}?status=pending|completed|all`
- Retorna tarefas pendentes e concluídas de um processo específico

**11. Corrigir mapeamento `create-customer`**
- Trocar campos incorretos: `individual_registration` → `identification`, `identity_card` → `document`
- Adicionar validação de `users_id` e `customers_origins_id` (obrigatórios pela nova doc)
- Formatar `postalcode` com hífen (obrigatório: 99999-999)

---

### Sobre conclusão de tarefas

Confirmado: a API **ainda não possui** endpoint para concluir tarefas (não existe `PUT /posts`). A conclusão continua sendo feita apenas localmente na tabela `advbox_tasks`. O case `complete-task` existente permanece com essa limitação documentada.

### Arquivos modificados

- `supabase/functions/advbox-integration/index.ts` — novos cases e correções
- `supabase/functions/rdstation-webhook/index.ts` — corrigir endpoint de tarefas
- `src/pages/TarefasAdvbox.tsx` — integrar criação de tarefas com API ADVBox
- Migração SQL — tabela `advbox_settings_cache`


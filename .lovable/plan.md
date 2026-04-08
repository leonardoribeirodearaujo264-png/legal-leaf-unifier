

## Gerar blueprint completo da integração ADVBox como arquivo para download

O sistema ADVBox no projeto é extremamente extenso (~10.000+ linhas distribuídas em 20+ arquivos). Vou consolidar tudo num documento Markdown organizado por seções.

### Escopo do blueprint

**Edge Functions (8 funções):**
1. `advbox-integration` (1877 linhas) — Hub central: processos, movimentações, tarefas, transações, clientes, publicações, usuários, criação de tarefas, busca de responsáveis
2. `sync-advbox-tasks` (280 linhas) — Sincronização incremental de tarefas para tabela local
3. `sync-advbox-customers` (303 linhas) — Sincronização incremental de clientes com trava de concorrência e retomada
4. `sync-advbox-financial` (955 linhas) — Sincronização de transações financeiras com mapeamento de categorias
5. `sync-advbox-status` — Sincronizar status de processos para contratos
6. `advbox-cache-refresh` — Cron job de atualização automática de cache
7. `translate-movement` (111 linhas) — Tradução de andamentos jurídicos via IA (Claude)
8. `suggest-task` (264 linhas) — Sugestão de tarefas via IA baseado em movimentações
9. `advbox-manual-registration` (341 linhas) — Cadastro manual de cliente/processo no ADVBox

**Páginas Frontend (8 páginas):**
1. `ProcessosDashboard.tsx` (1724 linhas) — Dashboard principal com gráficos e estatísticas
2. `ProcessosAtivos.tsx` (883 linhas) — Lista de processos ativos com geração de contratos/procurações
3. `MovimentacoesAdvbox.tsx` (591 linhas) — Movimentações com criação de tarefas e sugestões IA
4. `TarefasAdvbox.tsx` (1520 linhas) — Gestão de tarefas com calendário, relatórios e prioridades
5. `AdvboxAnalytics.tsx` (868 linhas) — Análises com gráficos e exportação PDF/Excel
6. `AdvboxConfig.tsx` (197 linhas) — Configurações de cache e rate limiting
7. `ControlePrazos.tsx` — Controle de prazos processuais com verificação
8. `TraducaoAndamentos.tsx` — Tradução de andamentos técnicos para linguagem simples

**Componentes compartilhados (6):**
- `AdvboxCacheAlert`, `AdvboxDataStatus`, `TaskCreationDialog`, `TaskCreationForm`, `TaskSuggestionsPanel`, `AdvboxFinancialSync`

**Tabelas de banco (7+):**
- `advbox_customers`, `advbox_tasks`, `advbox_sync_status`, `advbox_tasks_sync_status`, `advbox_settings`, `advbox_dashboard_cache`, `advbox_financial_sync`

### O que vou incluir no arquivo

1. Visão geral da arquitetura
2. Tabelas SQL completas com RLS
3. Código completo de todas as 9 Edge Functions
4. Código completo de todas as 8 páginas e 6 componentes
5. Erros conhecidos e soluções já aplicadas (rate limiting, ID composto, classificação de categorias, trava de concorrência, timeout)
6. Dependências e rotas

### Formato de entrega

Arquivo Markdown em `/mnt/documents/blueprint-advbox-integration.md`


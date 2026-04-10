

## Migração completa: CRM independente sem RD Station

### Situação atual

Seus dados **já estão no banco da intranet**:
- **1.932 contatos** (1.929 com vínculo ao RD Station)
- **1.971 oportunidades** (todas com vínculo ao RD Station)
- **6.755 atividades**
- **10 etapas** em 1 pipeline
- Histórico de movimentações, tarefas, comissões, campanhas

O CRM já funciona localmente — contatos, pipeline, kanban, atividades, lead scoring, follow-up, tarefas, ranking, contratos. **A dependência do RD Station está em 3 pontos específicos:**

1. **Sync automático** — a edge function `crm-auto-sync` roda a cada 3h chamando `crm-sync` com `full_sync`, que puxa dados da API do RD Station
2. **Sync bidirecional em ações do usuário** — ao criar/editar contato ou mover deal, o código chama `crm-sync` para atualizar no RD Station
3. **Busca de atividades em tempo real** — ao abrir um contato, busca atividades direto da API do RD Station via `crm-sync`

### O que vou fazer

**Etapa 1 — Importação final completa**
- Criar uma edge function `rd-station-final-import` que faz uma última sincronização completa: todos os contatos, oportunidades e atividades do RD Station, garantindo que nenhum dado fique para trás.
- Executar essa importação antes de cortar a conexão.

**Etapa 2 — Tornar o CRM 100% local**
- **`CRMContactsList.tsx`**: Remover chamadas ao `crm-sync` para criar/editar contatos. Todas as operações passam a ser diretas no banco local. Remover busca de atividades via API do RD Station — usar apenas a tabela `crm_activities` local.
- **`CRMDealsKanban.tsx`**: Remover chamadas ao `crm-sync` para atualizar deals e mover etapas. Tudo direto no banco local.
- **`CRMDashboard.tsx`**: Remover botão de "Sincronizar com RD Station". Remover referências visuais ao RD Station.
- **`CRMSettings.tsx`**: Remover toggle de sync com RD Station. Simplificar a tela de configurações.

**Etapa 3 — Funcionalidades nativas que substituem o RD Station**
- **Criar contato**: já funciona localmente (caminho `syncEnabled = false`), apenas tornar esse o caminho padrão.
- **Criar oportunidade**: implementar criação direta de deal no banco sem depender do RD Station.
- **Registrar atividades**: implementar criação de atividades (ligação, email, reunião, nota) diretamente na tabela `crm_activities` local, sem depender da API.
- **Criar contato a partir de deal**: quando um deal é criado sem contato vinculado, permitir criar o contato na hora.

**Etapa 4 — Limpeza**
- Desativar o cron job `crm-auto-sync`.
- Manter as edge functions `crm-sync`, `crm-webhook`, `crm-auto-sync` no código mas sem uso ativo (podem ser removidas depois).
- Remover referências visuais ao "RD Station" na interface do CRM.

### Arquivos que serão alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/CRMContactsList.tsx` | Remover chamadas crm-sync, usar banco local direto |
| `src/components/crm/CRMDealsKanban.tsx` | Remover chamadas crm-sync, operações locais |
| `src/components/crm/CRMDashboard.tsx` | Remover botão sync RD Station |
| `src/components/crm/CRMSettings.tsx` | Remover toggle sync RD Station |
| `supabase/functions/rd-station-final-import/index.ts` | **Novo** — importação final |

### O que NÃO muda
- Estrutura das tabelas (já está completa)
- Pipeline e etapas (já existem localmente)
- Kanban drag-and-drop (já funciona)
- Lead scoring, follow-up, tarefas, comissões, ranking
- Webhooks do RD Station (simplesmente deixam de receber dados)

### Resumo
Sim, é totalmente possível. Seus dados já estão aqui. O trabalho é: (1) fazer uma última importação completa, (2) cortar as chamadas à API do RD Station no código, e (3) garantir que criar/editar contatos, deals e atividades funcione 100% local.


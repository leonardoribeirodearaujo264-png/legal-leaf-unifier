

## Criar aba "Pendências" no CRM

### Resumo

Nova aba no CRM chamada "Pendências" com ícone de alerta, focada em pressão visual para o time comercial resolver tarefas antes de sair. Lista todas as tarefas não concluídas, destacando atrasadas em vermelho, com filtro por responsável.

### Alterações

**1. Novo componente `src/components/crm/CRMPendingTasks.tsx`**

- Busca tarefas de `crm_activities` onde `completed = false` ou `status != 'completed'`
- Exibe em lista com colunas: Tarefa, Tipo, Responsável, Data limite, Prioridade, Status
- Cards de resumo no topo: Total pendentes, Atrasadas (vermelho pulsante), Vencendo hoje (amarelo), Sem data
- Filtro por responsável (dropdown com vendedores: Daniel, Lucas + outros)
- Filtro por prioridade (alta, média, baixa)
- Ordenação padrão: atrasadas primeiro, depois por data limite
- Linhas atrasadas com fundo vermelho claro e badge "ATRASADA"
- Linhas vencendo hoje com fundo amarelo claro e badge "HOJE"
- Botão para marcar como concluída direto da lista

**2. Atualizar `src/components/crm/CRMDashboard.tsx`**

- Importar `CRMPendingTasks`
- Adicionar nova aba "Pendências" com ícone `AlertTriangle` (já importado) e badge com contador de pendentes
- Posicionar a aba logo após "Tarefas" para dar visibilidade

**3. Atualizar `src/components/crm/index.ts`**

- Exportar `CRMPendingTasks`

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/crm/CRMPendingTasks.tsx` | Novo componente |
| `src/components/crm/CRMDashboard.tsx` | Adicionar aba "Pendências" |
| `src/components/crm/index.ts` | Exportar novo componente |

Nenhuma alteração no banco de dados — usa a tabela `crm_activities` existente.


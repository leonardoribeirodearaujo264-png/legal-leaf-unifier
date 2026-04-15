

## Padronizar Criação de Tarefa em Todas as Telas ADVBox

### Diagnóstico

Após inspeção de todas as telas, confirmei que:

- **MovimentacoesAdvbox**, **ProcessosAtivos**, **ProcessosDashboard** → usam `TaskCreationDialog` (que internamente usa `TaskCreationForm`) — campos completos ✅
- **PublicacoesFeed** → usa `TaskCreationForm` diretamente com preview da publicação — campos completos ✅
- **TarefasAdvbox (botão "Nova Tarefa")** → usa `TaskCreationForm` diretamente — campos completos ✅
- **RelatoriosProdutividadeTarefas (aba Produtividade / Ranking)** → **NÃO TEM opção de criar tarefa** ❌

O problema é que a aba de Produtividade/Ranking de tarefas não possui nenhum botão ou funcionalidade para criar tarefas. As demais telas já usam o mesmo componente `TaskCreationForm` com campos idênticos.

### Alterações

**Arquivo: `src/pages/RelatoriosProdutividadeTarefas.tsx`**

1. Importar `TaskCreationForm`, `Dialog`, `ScrollArea`, `Label`, `Plus`
2. Adicionar estados: `dialogOpen`, `newTaskProcessNumber`, `isCreatingTask`, `advboxTaskTypes`, `advboxUsers`, `loadingTaskTypes`, `loadingUsers`
3. Adicionar funções `fetchAdvboxTaskTypes` e `fetchAdvboxUsers` (chamando `advbox-integration/task-types` e `advbox-integration/users`)
4. Adicionar botão "Nova Tarefa" no header (ao lado dos filtros)
5. Adicionar Dialog com:
   - Campo "Número do Processo" (igual ao da TarefasAdvbox)
   - `TaskCreationForm` com todos os campos (título, descrição, categoria, responsável, participantes, datas, prazo, local, urgente/importante, sugestão IA)
   - Lógica de submit que busca o `lawsuit_id` pelo número do processo

O dialog será idêntico ao que já existe na página TarefasAdvbox (linhas 671-783), garantindo 100% de consistência.

### Resultado
- Todas as 6 telas de criação de tarefa ADVBox terão os mesmos campos
- A sugestão com IA funciona em todas (incluindo modo "criação livre")
- Nenhum componente existente é alterado — apenas o relatório de produtividade recebe o botão que faltava


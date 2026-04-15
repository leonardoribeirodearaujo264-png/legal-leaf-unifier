

## Padronizar Criação de Tarefa ADVBox + Sugestão IA do Zero

### Diagnóstico

Todas as telas de criação de tarefa ADVBox **já usam o mesmo componente** (`TaskCreationForm`). Os campos são idênticos. O problema real é:

1. **Sugestão com IA não funciona ao criar do zero**: O botão "Sugerir Tarefa com IA" envia `movementTitle` e `publicationContent` baseados no `initialData`, que vêm vazios quando se cria uma tarefa do zero (na aba de ranking/lista). A edge function `suggest-task` retorna erro 400 porque exige pelo menos um deles.

2. **A IA deveria usar o que o usuário digitou**: Quando não há contexto de movimentação, a IA deve usar o que o usuário já digitou nos campos "Título" e "Descrição" para sugerir a tarefa.

### Alterações

**Arquivo: `src/components/TaskCreationForm.tsx`**

- Atualizar a função `suggestTaskWithAI` para enviar os valores **atuais** dos campos `taskTitle` e `comments` (não os do `initialData`)
- Se o usuário não digitou nada nos campos, mostrar um toast pedindo que preencha pelo menos o título ou descrição antes de sugerir
- Ajustar o texto do botão: quando não há contexto de movimentação, mostrar "Descreva a tarefa e clique para sugerir com IA"

**Arquivo: `supabase/functions/suggest-task/index.ts`**

- Relaxar a validação: aceitar `publicationContent` mesmo sem `movementTitle` (já aceita)
- Adicionar um modo "criação livre" no prompt: quando o conteúdo não parece ser uma movimentação processual, a IA deve sugerir categoria, prazo e detalhamento com base na descrição do usuário
- Manter o comportamento atual para movimentações (backward-compatible)

### Resultado
- O botão "Sugerir com IA" funciona em **todos** os contextos de criação de tarefa
- Quando há movimentação: sugere baseado no andamento (como hoje)
- Quando é criação livre: sugere baseado no que o usuário digitou
- Layout e campos continuam 100% idênticos em todas as telas


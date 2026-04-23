

## Corrigir scroll do popup "Criar Tarefa" em Distribuição de Tarefas

### Problema

No popup que abre ao clicar em "+ Criar Tarefa" no ranking de colaboradores (`/distribuicao-tarefas`), o conteúdo é cortado e **não rola**. Você consegue ver até "Participantes" e o resto do formulário (Categoria, Prazo, Botão Salvar) fica inacessível.

### Causa

No arquivo `src/pages/DistribuicaoTarefas.tsx` (linhas 443-483), o `DialogContent` tem `max-h-[90vh]` mas **sem `overflow-y-auto`**, e o `ScrollArea` interno está envolvendo só uma parte do formulário sem altura calculada corretamente. Resultado: o conteúdo que ultrapassa 90vh simplesmente fica escondido.

A versão que funciona em outros lugares (ex: `TaskCreationDialog.tsx` usado em Movimentações) usa `max-w-2xl max-h-[90vh] overflow-y-auto` direto no `DialogContent`, sem `ScrollArea` interno — mais simples e sempre funciona.

### Correção

**Arquivo:** `src/pages/DistribuicaoTarefas.tsx` (apenas linhas 444 e 458/480)

1. Trocar `<DialogContent className="max-w-2xl max-h-[90vh]">` por `<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">` — o próprio dialog passa a rolar.
2. Remover o wrapper `<ScrollArea className="max-h-[60vh]">…</ScrollArea>` em volta do `<TaskCreationForm>`. O componente fica como filho direto do `<div className="space-y-4">`.
3. Remover o import não usado de `ScrollArea` se ele não for mais usado em nenhum outro lugar do arquivo (verifico antes de remover).

### Por que essa abordagem

- É **idêntica** ao padrão já usado no `TaskCreationDialog.tsx` (que funciona corretamente em Movimentações ADVBox e em Controle de Prazos).
- O Radix `DialogContent` com `overflow-y-auto` rola nativamente sem precisar de `ScrollArea` aninhado — `ScrollArea` aninhado dentro de Dialog é problemático porque depende de altura definida do pai, o que conflita com o `max-h` do dialog.
- Mantém o `max-h-[90vh]` para o popup nunca ultrapassar a tela.

### Não muda

- Lógica de criação de tarefa (handleCreateTask), busca de tipos/usuários, validações — nada.
- Outros popups (`TaskCreationDialog`, `TaskCreationForm`) — não tocados.
- Banco, RLS, edge functions — não tocados.

**Risco:** zero. Mudança puramente de CSS/estrutura DOM em um único bloco JSX.



## Corrigir exclusão de agentes de IA

### Causa raiz
O código usa `window.confirm()` para confirmar a exclusão. Em contextos de iframe (como o preview do Lovable), `confirm()` pode ser bloqueado pelo navegador ou retornar `false` automaticamente, fazendo com que a função retorne sem executar nada — parecendo que deu erro.

Além disso, mesmo quando funciona, a experiência com `confirm()` nativo é ruim (visual inconsistente, sem personalização).

### Solução
Substituir o `window.confirm()` por um **AlertDialog** do Radix (já disponível em `src/components/ui/alert-dialog.tsx`), que funciona em qualquer contexto e é visualmente consistente.

### Alteração

**Arquivo: `src/components/agents/IntranetAgentsTab.tsx`**

1. Adicionar estado `deletingAgentId` para controlar qual agente está sendo excluído
2. Substituir o `confirm()` por um `AlertDialog` controlado
3. O botão de excluir passa a abrir o dialog em vez de chamar `confirm()`
4. O botão "Confirmar" do dialog executa a exclusão via Supabase (`.update({ is_active: false })`)

Nenhuma migração necessária — as políticas de UPDATE já permitem a operação para o criador do agente.

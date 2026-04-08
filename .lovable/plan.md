

## Corrigir flash dos nomes na sidebar ao clicar em uma conversa

### Problema
Quando você clica em uma conversa, o hook `useMessaging` chama `fetchConversations()` internamente (via realtime handler e após marcar como lido). Cada chamada executa `setLoading(true)` na linha 64, o que faz a sidebar mostrar skeletons por alguns segundos antes de recarregar os dados.

### Solução
Usar `setLoading(true)` apenas no carregamento inicial (quando `conversations` está vazio). Nas atualizações subsequentes, atualizar os dados silenciosamente sem mostrar skeletons.

### Alteração

**`src/hooks/useMessaging.tsx`** — Modificar `fetchConversations`:
- Trocar `setLoading(true)` por uma verificação: só ativar loading se `conversations` estiver vazio (primeira carga)
- Nas recargas subsequentes (realtime, clique, envio), os dados atualizam sem flash

Concretamente, a linha `setLoading(true)` será substituída por:
```ts
// Só mostra skeleton no primeiro carregamento
if (conversations.length === 0) {
  setLoading(true);
}
```

Isso é seguro porque o `setConversations(...)` e `setLoading(false)` no final já garantem que a UI atualiza com os novos dados.


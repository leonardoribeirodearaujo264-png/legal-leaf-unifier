

## Corrigir scroll de mensagens e badge de não lidas

### Problema 1 — Mensagens não rolam até o final

O componente usa `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` para rolar até a última mensagem. Porém, o Radix `ScrollArea` cria um `Viewport` interno como container de scroll, e o `scrollIntoView` não funciona corretamente com ele — o scroll fica no topo.

**Solução**: Trocar `scrollIntoView` por acesso direto ao viewport do ScrollArea. Usar um `ref` no `ScrollArea` do chat e, após as mensagens carregarem, fazer `viewport.scrollTop = viewport.scrollHeight` no elemento `[data-radix-scroll-area-viewport]`.

**Arquivo**: `src/pages/Mensagens.tsx`
- Adicionar `useRef` para o container do ScrollArea de mensagens
- No `useEffect` que depende de `[messages]`, buscar o viewport real via `ref.current?.querySelector('[data-radix-scroll-area-viewport]')` e setar `scrollTop = scrollHeight`
- Usar `behavior: 'instant'` no carregamento inicial (não smooth, para não mostrar a rolagem toda) e `smooth` quando mensagem nova chega em tempo real

### Problema 2 — Badge de mensagens não zera após ler

Dois sub-problemas:

**2a.** Ao clicar numa conversa, o `last_read_at` é atualizado dentro de `fetchMessages`, mas a lista local de conversas (`conversations`) mantém o `unread_count` antigo até `fetchConversations` rodar (com setTimeout de 1500ms). Se o fetch falhar ou demorar, o badge fica preso.

**Solução**: Após `setActiveConversation`, zerar imediatamente o `unread_count` local daquela conversa no estado, sem esperar o refetch do banco. Isso dá feedback visual instantâneo.

**Arquivo**: `src/pages/Mensagens.tsx` (no onClick da conversa) e `src/hooks/useMessaging.tsx` (no `fetchMessages`, após marcar como lido)

**2b.** O `useMessageNotifications` calcula `unreadCount` iterando todas as participações. Se o `last_read_at` acabou de ser atualizado mas o `fetchUnreadCount` lê o valor antigo (cache/timing), o badge permanece. O `messages-read` event já dispara o refetch, mas pode haver timing issue.

**Solução**: No `useMessaging.tsx`, após o `update last_read_at` e `window.dispatchEvent('messages-read')`, também atualizar o `unread_count` local da conversa para 0 no state de `conversations`.

### Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Mensagens.tsx` | Substituir `scrollIntoView` por scroll direto no viewport do ScrollArea; zerar `unread_count` local ao clicar na conversa |
| `src/hooks/useMessaging.tsx` | Após marcar `last_read_at`, zerar `unread_count` da conversa no state local |

Nenhuma alteração no banco de dados.


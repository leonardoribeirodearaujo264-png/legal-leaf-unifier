

## Loop infinito ao abrir conversa interna — diagnóstico e correção

### Causa raiz (verificada no código)

Em `src/hooks/useMessaging.tsx`, encontrei um **ciclo de feedback** entre o subscribe realtime, `fetchConversations` e `activeConversation`:

**O ciclo (`useMessaging.tsx` linhas 574-674):**

1. `useEffect` que cria o canal realtime depende de `[user, activeConversation, fetchConversations]`.
2. Sempre que o usuário **clica numa conversa** (ou abre via notificação), `activeConversation` muda → o `useEffect` **desmonta o canal antigo e cria um novo**.
3. Dentro do handler de `INSERT` em `messages`, ele chama `fetchConversations()` (linha 625).
4. `fetchConversations` é um `useCallback` que depende de `[user]`, mas internamente faz `setConversations(...)`.
5. A mudança em `conversations` dispara o `useEffect` em `Mensagens.tsx` linha 125-136 (`location.state, conversations, setActiveConversation`), que **chama `setActiveConversation(conv)` novamente** porque `state.openConversation` ainda existe (ele só é limpo via `window.history.replaceState` mas o `location.state` do React Router NÃO é atualizado em tempo real).
6. `setActiveConversation` muda → volta ao passo 2 → **loop infinito**.

**Confirmações adicionais que agravam:**

- **Linha 680-684**: `useEffect(() => { fetchMessages(activeConversation.id); }, [activeConversation, fetchMessages])` — toda vez que `activeConversation` muda (mesmo sendo o mesmo objeto recriado), refaz `fetchMessages`, que reseta `loadingMessages=true` → mostra "Carregando..." → resolve → e o ciclo recomeça em milissegundos. **Isso bate exatamente com o sintoma relatado**: "fica recarregando, aparece o chat por milésimos de segundos, volta a recarregar".
- **Linha 230-240 de `fetchMessages`**: cada execução faz `upsert` em `message_deliveries`, que dispara o subscribe realtime `INSERT message_deliveries` (linha 631-645) → atualiza `setDeliveries` → re-render → reforça o ciclo.
- **`fetchConversations` chamado a cada nova mensagem**: refaz 4 queries pesadas + 1 query de count POR conversa (loop em `for` sequencial linha 163-177). Em escritórios com muitas conversas, isso trava a UI.

### Correção

**A. Quebrar o ciclo do subscribe realtime (`useMessaging.tsx`)**

1. Remover `activeConversation` e `fetchConversations` das dependências do `useEffect` do canal realtime. Usar `useRef` para acessar o valor atual de `activeConversation` dentro do handler sem recriar o canal.
2. Substituir `fetchConversations()` dentro do handler por uma atualização **incremental** (setConversations atualiza só `last_message`/`updated_at`/`unread_count` da conversa afetada) — sem refazer todas as queries.
3. Resultado: o canal realtime é criado **uma única vez** por sessão e persiste entre mudanças de conversa.

**B. Limpar `location.state` corretamente em `Mensagens.tsx` (linha 125-136)**

Usar `useNavigate` do React Router para limpar o `state` de fato:
```ts
const navigate = useNavigate();
useEffect(() => {
  const state = location.state as { openConversation?: string } | null;
  if (state?.openConversation && conversations.length > 0) {
    const conv = conversations.find(c => c.id === state.openConversation);
    if (conv && conv.id !== activeConversation?.id) {
      setActiveConversation(conv);
      setShowMobileChat(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }
}, [location.state, conversations]);
```
- Adicionar guard `conv.id !== activeConversation?.id` para evitar setar a mesma conversa.
- Trocar `window.history.replaceState` por `navigate(..., {replace, state: null})` que de fato remove o state do React Router.

**C. Estabilizar `fetchMessages` para evitar refetch desnecessário**

No `useEffect` linha 680-684 do hook:
- Trocar dependência de `activeConversation` para `activeConversation?.id` — assim só dispara quando o ID realmente muda, não quando o objeto é recriado pela atualização de `participants` (linha 657-665).

**D. Otimizar atualização local de `last_read_at`**

A subscription `UPDATE conversation_participants` recria `activeConversation` via `setActiveConversation(prev => ({...prev, participants: ...}))`. Isso muda a referência e dispara o `useEffect` de `fetchMessages` (item C resolve isso). Mas também devemos garantir que essa atualização **não passe pelo ciclo** se for o próprio usuário marcando como lido.

**E. Substituir o for-loop sequencial de unread_count (linha 163-177)**

Trocar por **uma única query agregada**:
```ts
const { data: unreadAgg } = await supabase
  .from('messages')
  .select('conversation_id', { count: 'exact' })
  .in('conversation_id', conversationIds)
  .neq('sender_id', user.id);
// E filtrar por last_read_at no client com base em allParticipants
```
Reduz N+1 queries a 1, eliminando o travamento que dá impressão de loop.

### Arquivos modificados
- `src/hooks/useMessaging.tsx` — refatorar useEffect do realtime (sem dependência de activeConversation), atualização incremental de conversations, dependência por ID em fetchMessages
- `src/pages/Mensagens.tsx` — corrigir limpeza de `location.state` com `useNavigate` e guard de ID

Sem migração de banco. Sem mudanças em outras telas.




## Três correções nas Mensagens Internas

### 1. Contagem de não lidas inconsistente entre lista e aba do navegador

**Causa**: O `useMessaging.tsx` conta não lidas filtrando `lastMessages` — que é uma query de até 1000 mensagens ordenada por `created_at desc` em todas as conversas. Já o `useMessageNotifications.tsx` faz queries individuais por conversa com `count: 'exact'`. Isso gera divergência: a aba do navegador pode mostrar não lidas que a lista de conversas não mostra (e vice-versa).

**Correção em `src/hooks/useMessaging.tsx`** (linhas 127-133):
- Substituir a contagem baseada em `lastMessages` por queries individuais com `count: 'exact'` por conversa (mesmo método do `useMessageNotifications`), garantindo que os dois contadores usem a mesma lógica.
- Alternativamente, após carregar as conversas, fazer uma query separada para cada conversa buscando `count` de mensagens onde `sender_id != user.id` e `created_at > last_read_at`.

### 2. Filtro de mensagens não lidas na lista de conversas

**Correção em `src/pages/Mensagens.tsx`**:
- Adicionar um estado `showUnreadOnly` (boolean, default false).
- Ao lado da barra de busca (linha ~1287), adicionar um botão/toggle "Não lidas" que ativa/desativa o filtro.
- No `filteredConversations` (linha 1177), quando `showUnreadOnly` estiver ativo, filtrar apenas `conv.unread_count > 0`.
- Ao clicar numa conversa, o `fetchMessages` já marca como lida (linha 212-220). Após marcar, disparar `fetchConversations()` para atualizar a contagem na lista e o `messages-read` event para atualizar a aba.

### 3. Nomes cortados na lista de conversas

**Causa**: O nome usa `line-clamp-2` mas a largura do contêiner ainda é insuficiente para nomes longos como "Mariana Alves Amorim Corrêa Fulgêncio".

**Correção em `src/pages/Mensagens.tsx`** (linhas 1362-1367):
- Trocar `line-clamp-2` por `break-words` com wrap natural, sem truncar. Usar `word-break: break-word` e remover o `line-clamp` para que o nome quebre livremente para a linha de baixo.
- Manter `min-w-0` no container pai para funcionar com flexbox.

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useMessaging.tsx` | Corrigir contagem de não lidas para usar queries exatas por conversa |
| `src/pages/Mensagens.tsx` | Adicionar filtro "Não lidas", corrigir nome truncado |


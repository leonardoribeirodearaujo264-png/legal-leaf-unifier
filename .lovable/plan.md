

## Por que a Letícia (admin) não conseguiu editar + tique azul não aparece

### Diagnóstico (verificado no banco e código)

**1. Edição da Letícia** — Confirmei no banco:
- Letícia (`leticiapessoa@eggnunes.com.br`) tem `role='admin'`, `position='administrativo'`, `is_active=true`, `approval_status='approved'`.
- A política RLS da tabela `messages` para UPDATE permite admin: `sender_id = auth.uid() OR has_role(auth.uid(),'admin') OR is_socio_or_rafael(auth.uid())` ✓
- A função `canEditMessage` na UI usa `isAdmin || isSocio` — correto.

**Causa real**: a Letícia testou ANTES da última correção entrar em produção (a alteração que liberou edição para admin foi feita no chat anterior — ela pode ter testado com a versão antiga em cache do browser, OU ainda não recarregou a página). A correção já está no código.

**Mas há dois bugs sutis que ainda podem bloquear ela:**
- **(a)** A janela de 3h é calculada com `differenceInMinutes(new Date(), msg.created_at) > 180`. Se a Letícia tentou editar uma mensagem **antiga (>3h)**, o botão não aparece — mesmo sendo admin. Pelo plano anterior, admins só editam dentro da janela de 3h. Preciso confirmar com você: **admin deve poder editar SEM limite de tempo?**
- **(b)** O dropdown da mensagem só renderiza o item "Editar" se `canEditMessage(msg) === true`. Se `useUserRole` ainda estiver com `loading=true` no primeiro render, `isAdmin` vem `false` e o botão fica escondido. Precisa de um guard de loading.

**2. Tique azul de "entregue" não funciona** — A heurística atual usa `usePresence` (Supabase Realtime presence channel `online-users`). Problemas:
- Presence só rastreia usuários **com a aba aberta no momento**. Se a Letícia mandou mensagem e a outra pessoa estava com a aba fechada, nunca vira "delivered" — fica eternamente como 1 tique cinza.
- Pior: se o destinatário abre e fecha a aba antes da Letícia olhar, ela nunca vê o estado "entregue", só pula para "lido" quando ele entra na conversa.
- Resultado: na prática, **só funciona se ambos estiverem online ao mesmo tempo** — o que raramente acontece.

**Solução**: implementar entrega de verdade com uma coluna `delivered_at` por destinatário, marcada quando a mensagem chega ao realtime do destinatário (ou quando ele faz fetch). Sem isso, a heurística por presença é instável.

### Correções

**A. Edição (UI) — `src/pages/Mensagens.tsx`**
1. Adicionar guard de loading do `useUserRole`: enquanto `loading=true`, não esconder o botão prematuramente — esperar a role carregar antes de avaliar `canEditMessage`.
2. Decidir: **admins podem editar sem limite de 3h?** Sugiro: **autor → 3h**, **admin/sócio → sem limite** (faz sentido para moderação). [confirmar abaixo]

**B. Tique de entrega — implementar `delivered_at` real**

Criar tabela:
```sql
CREATE TABLE message_deliveries (
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
ALTER TABLE message_deliveries ENABLE ROW LEVEL SECURITY;
-- Policy: usuário pode inserir/ver suas próprias entregas
```

No frontend (`useMessaging.tsx`):
- No subscribe realtime de `INSERT` em `messages`, todo participante (que não seja o sender) faz `INSERT` em `message_deliveries` automaticamente assim que recebe o evento — mesmo sem abrir a conversa, basta a aba estar aberta em qualquer página da intranet.
- Adicional: ao fazer `fetchMessages`, marcar como entregues todas as mensagens que ainda não tinham `delivered_at` para o usuário atual (cobre quem estava offline e abriu depois).
- Em `Mensagens.tsx`, `getMessageStatus` consulta `message_deliveries` em vez de `usePresence`: `delivered` = existe registro de entrega para algum outro participante; `read` = `last_read_at >= created_at`.

**C. Subscription para atualizar status em tempo real**
- Subscrever `message_deliveries` (INSERT) na conversa ativa para o tique cinza virar azul automaticamente assim que o destinatário recebe.
- Subscrever `conversation_participants` (UPDATE em `last_read_at`) para o segundo tique azul aparecer assim que ele lê.

### Arquivos modificados
- `supabase/migrations/...` (nova migration) — criar `message_deliveries` + RLS + realtime
- `src/hooks/useMessaging.tsx` — auto-insert em `message_deliveries` no realtime e no fetch; expor `deliveries` por mensagem
- `src/pages/Mensagens.tsx` — guard de loading de role; novo `getMessageStatus` baseado em `message_deliveries`; subscription para deliveries e last_read_at

### Pergunta antes de executar
**Admin/sócio devem poder editar mensagens sem limite de tempo (sem janela de 3h)?** Recomendo **sim** — fica claro e consistente com o papel de moderação. Se preferir manter 3h também para admins, faço só os bugs (a) e (b) e o sistema de delivery.


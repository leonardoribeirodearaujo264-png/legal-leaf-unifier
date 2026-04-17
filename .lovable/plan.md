

## Corrigir edição de mensagens internas + adicionar tiques de entrega/leitura estilo WhatsApp

### Diagnóstico

**1. Edição:** O código atual em `Mensagens.tsx` linha 630-635 só permite o autor editar dentro de 6h. Não há permissão extra para admins. A política RLS no banco **já está correta** (`sender_id = auth.uid() OR has_role admin OR is_socio_or_rafael`), só falta refletir isso na UI.

**2. Tiques de leitura:** Existe apenas 2 estados (1 cinza = não lido, 2 azuis = lido). Falta o estado intermediário "entregue" (1 azul). Hoje o sistema não rastreia entrega — só leitura via `last_read_at`.

### Correção

**A. Edição de mensagens (`src/pages/Mensagens.tsx`)**

Atualizar `canEditMessage` (linha 630):
- **Autor da mensagem:** pode editar até **3 horas** após envio
- **Admins/sócios/Rafael:** podem editar **qualquer mensagem** até **3 horas** após envio
- **Mensagens recebidas (não-autor, não-admin):** **não** pode editar (regra atual já correta)

```ts
const canEditMessage = (msg: Message) => {
  const minutesSinceSent = differenceInMinutes(new Date(), new Date(msg.created_at));
  if (minutesSinceSent > 180) return false; // 3h limit para todos
  if (msg.sender_id === user?.id) return true; // autor
  if (isAdmin || isSocio) return true; // admin pode editar qualquer uma dentro de 3h
  return false;
};
```

Adicionar `useUserRole` import + hook (já existe no projeto).

**B. Tiques de entrega + leitura (estilo WhatsApp)**

Como rastrear "entregue" sem campo dedicado: usar uma proxy realista — **mensagem é "entregue" se o destinatário tem sessão/presença ativa OU já abriu a conversa pelo menos uma vez após o envio** (via `joined_at`/conexão ao realtime).

Solução pragmática sem migração:
- **1 tique cinza** (`text-muted-foreground`): mensagem enviada, ainda não confirmada entrega
- **1 tique azul** (`text-blue-500`): destinatário está com presença ativa (online via `usePresence`) → considerada entregue
- **2 tiques azuis**: destinatário leu (`last_read_at >= created_at`)

Atualizar `isMessageRead` (linha 1148) e criar `getMessageStatus(msg)` retornando `'sent' | 'delivered' | 'read'`. Renderizar:
```tsx
{status === 'read' && <><Check blue/><Check blue -ml/></>}
{status === 'delivered' && <><Check blue/><Check blue muted-opacity/></>}
{status === 'sent' && <Check gray />}
```

Para "delivered" usar `usePresence` (já existe) verificando se algum outro participante está `online`. Em grupos, basta um participante online para marcar como entregue.

**Opcional (futuro)**: adicionar coluna `delivered_at` em `messages` ou tabela `message_deliveries(message_id, user_id, delivered_at)` para rastreamento real. Por ora, a heurística por presença é suficiente e não exige migração.

### Resultado
- Autor edita sua própria mensagem em até 3h
- Admins/Sócios/Rafael editam qualquer mensagem em até 3h  
- Mensagens recebidas (não-admin) continuam **não-editáveis** (regra mantida)
- 3 estados visuais de tiques: enviado (1 cinza) → entregue (1 azul) → lido (2 azuis)

### Memória a salvar
Atualizar `mem://features/internal-messaging-chat-system` com as novas regras de edição (3h para autor, 3h para admin) e o sistema de 3 tiques (sent/delivered/read).

### Arquivos modificados
- `src/pages/Mensagens.tsx` — atualizar `canEditMessage`, adicionar `getMessageStatus`, renderizar 3 estados de tique
- `mem://features/internal-messaging-chat-system` — atualizar regra

Sem migração de banco. Política RLS já permite admin editar.


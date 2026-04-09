

## Notificação nativa do sistema (próxima ao relógio) mesmo com aba minimizada

### Situação atual

O código já usa a API `new Notification()` do navegador (linha 116-134 do `useMessageNotifications.tsx`), que deveria mostrar notificações do sistema operacional perto do relógio. Porém há dois problemas:

1. **Permissão não garantida** — O pedido de permissão (linha 110-112) acontece silenciosamente ao carregar a página. Se o usuário ignorar ou fechar o prompt, as notificações nativas nunca funcionam. Não há nenhum feedback visual na interface indicando que está bloqueado.

2. **Sem Service Worker** — A API `new Notification()` usada diretamente na página funciona quando a aba está aberta (mesmo minimizada), mas pode falhar se o navegador suspender a aba por inatividade. Um **Service Worker** com `self.registration.showNotification()` é mais confiável para cenários em background.

### Solução

#### 1. Criar Service Worker para notificações (`public/sw-notifications.js`)

Arquivo simples que:
- Escuta eventos `push` e `notificationclick`
- Ao clicar na notificação, foca na aba da intranet e navega para `/mensagens`

#### 2. Registrar o Service Worker (`src/hooks/useMessageNotifications.tsx`)

- No `useEffect` inicial, registrar `navigator.serviceWorker.register('/sw-notifications.js')`
- Guardar o `registration` em um `useRef`

#### 3. Usar `registration.showNotification()` em vez de `new Notification()`

Na função `sendNativeNotification`, trocar:
```ts
// Antes
const notification = new Notification(title, { body, icon, tag });

// Depois
if (swRegistrationRef.current) {
  swRegistrationRef.current.showNotification(title, { body, icon, tag, data: { conversationId } });
} else {
  // Fallback para Notification direta
  new Notification(title, { body, icon, tag });
}
```

A diferença é que `registration.showNotification()` funciona mesmo com a aba suspensa pelo navegador.

#### 4. Adicionar banner de permissão na interface (`src/components/Layout.tsx`)

Se `Notification.permission === 'default'` (nunca respondeu), mostrar um banner discreto abaixo do header:
> "🔔 Ative as notificações para receber alertas de novas mensagens mesmo com a aba minimizada" [Ativar]

Ao clicar em "Ativar", chamar `Notification.requestPermission()`. Se `denied`, mostrar instrução para desbloquear nas configurações do navegador.

#### 5. Indicador no header se notificações estão bloqueadas

Se `Notification.permission === 'denied'`, mostrar um ícone de sino com um "x" vermelho no header, com tooltip explicando como reativar.

### Resultado esperado

- Mesmo com a aba minimizada ou outra janela na frente, o Windows/Mac mostrará a notificação nativa próxima ao relógio
- O usuário pode clicar na notificação e a intranet abrirá diretamente na conversa
- Se a permissão não foi concedida, um banner claro guia o usuário a ativá-la

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `public/sw-notifications.js` | Criar — Service Worker |
| `src/hooks/useMessageNotifications.tsx` | Registrar SW + trocar `new Notification` por `registration.showNotification` |
| `src/components/Layout.tsx` | Adicionar banner de permissão quando `Notification.permission === 'default'` |


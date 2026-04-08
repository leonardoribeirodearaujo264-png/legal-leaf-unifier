

## Corrigir notificações de mensagens internas que não chegam

### Diagnóstico

Encontrei o problema principal: **a assinatura Realtime é instável**. O `useEffect` que cria o canal de escuta (linha 221) tem `showNotification` nas dependências. Como `showNotification` depende de `location.pathname` e `popupEnabled`, **toda vez que o usuário muda de página**, o canal é destruído e recriado. Durante essa janela de reconexão, mensagens podem ser perdidas.

Além disso, a lista de `conversationIds` é capturada uma única vez no momento da assinatura — se o usuário entrar em uma nova conversa, não recebe notificação dela.

### Solução

**Arquivo: `src/hooks/useMessageNotifications.tsx`**

1. **Estabilizar a assinatura Realtime** — Usar `useRef` para `showNotification`, `popupEnabled` e `location.pathname`, removendo-os das dependências do `useEffect`. Assim o canal é criado uma única vez e sobrevive a mudanças de rota.

2. **Atualizar lista de conversas dinamicamente** — Guardar `conversationIds` em um `useRef` e atualizar sempre que `fetchUnreadCount` roda (que já busca as participações).

3. **Garantir pedido de permissão nativa** — Mover o `Notification.requestPermission()` para ser chamado também quando o primeiro evento de mensagem chega (caso o usuário não tenha respondido ao prompt inicial).

4. **Adicionar log de diagnóstico temporário** — Console.log discreto no subscribe para confirmar que o canal está ativo.

### Resultado esperado

- O banner nativo do Windows (como Teams) aparecerá próximo ao relógio sempre que uma mensagem chegar, mesmo se o usuário estiver navegando entre páginas
- O popup dentro da aplicação (MessagePopupDialog) também continuará funcionando
- A assinatura será estável e não será destruída/recriada a cada navegação


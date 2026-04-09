
Diagnóstico

Há 2 causas no código atual:

1. Em `src/hooks/useMessageNotifications.tsx`, a lógica cancela toda notificação quando a rota atual é `/mensagens`. Então, se a pessoa deixou essa tela aberta mas a aba/janela está minimizada ou atrás de outra janela, o sistema não dispara o alerta do Windows.

2. O `public/sw-notifications.js` atual só trata `notificationclick`. Ele não recebe `push`. Na prática, o app ainda depende da própria aba receber o evento Realtime e chamar `showNotification()`. Isso não é notificação em background no padrão “Teams”. Se a aba for suspensa pelo navegador, nada chega perto do relógio.

Ou seja: existe um bug imediato de lógica, e também uma limitação estrutural da implementação atual.

Plano

1. Corrigir a supressão indevida no hook de mensagens
   - Em `src/hooks/useMessageNotifications.tsx`, trocar a regra “se está em `/mensagens`, não notifica” por uma checagem real de visibilidade/foco.
   - Só suprimir popup interno quando a intranet estiver visível e em foco.
   - Se `document.hidden`, `document.visibilityState !== 'visible'` ou `!document.hasFocus()`, disparar a notificação nativa.

2. Implementar push real de navegador
   - Expandir `public/sw-notifications.js` para escutar `push` além de `notificationclick`.
   - Assim o próprio service worker mostra a notificação do sistema, mesmo com a aba em segundo plano.

3. Adicionar persistência das subscriptions no backend
   - Criar uma tabela `browser_push_subscriptions` com `user_id` (referenciando `public.profiles`), `endpoint`, `p256dh`, `auth`, `user_agent`, `is_active` e timestamps.
   - Aplicar RLS para cada usuário gerenciar apenas as próprias subscriptions.
   - Configurar chaves VAPID no backend e expor a chave pública ao cliente.

4. Registrar a subscription no cliente
   - Em `useMessageNotifications`, após permissão concedida e `serviceWorker.ready`, usar `pushManager.subscribe(...)`.
   - Salvar/atualizar a subscription no backend.
   - Manter o fluxo atual como fallback para navegadores sem `PushManager`.

5. Enviar push quando uma mensagem for criada
   - Criar uma função backend `notify-internal-message` que recebe `messageId`, valida o remetente, busca os participantes e envia Web Push aos demais.
   - Chamar essa função nos 2 pontos de envio atuais:
     - `src/hooks/useMessaging.tsx`
     - `src/components/MessagePopupDialog.tsx`
   - Isso cobre envio normal e resposta rápida.

6. Evitar alertas duplicados
   - Intranet visível/em foco: manter popup interno/top-right.
   - Intranet minimizada ou em segundo plano: priorizar notificação do sistema perto do relógio.
   - Invalidar subscriptions expiradas quando o push falhar.

Fluxo final
```text
mensagem enviada
→ backend dispara Web Push
→ service worker recebe push
→ Windows/macOS mostra o banner perto do relógio
→ clique abre/foca /mensagens na conversa correta
```

Arquivos envolvidos
- `src/hooks/useMessageNotifications.tsx`
- `public/sw-notifications.js`
- `src/hooks/useMessaging.tsx`
- `src/components/MessagePopupDialog.tsx`
- nova migration para `browser_push_subscriptions`
- nova função backend para envio de Web Push

Validação
- testar com a intranet aberta e visível;
- testar em `/mensagens` com a aba minimizada;
- testar com outra janela na frente;
- testar clique no banner abrindo a conversa certa;
- confirmar que continua sem e-mail de nova mensagem.

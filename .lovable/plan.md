

## Melhorar notificações de mensagens internas

### Situação atual
O sistema já tem:
- `MessagePopupDialog`: card no canto inferior direito com avatar, preview e resposta rápida (30s de auto-dismiss)
- `NotificationToast`: toasts genéricos para `realtime_notifications`
- Notificação nativa do navegador (Web Notification API)
- Som de notificação referenciando `/notification.mp3` — mas o arquivo **não existe** no `public/`
- Envio de e-mail para cada mensagem nova via `sendNewMessageEmail`

### Problemas identificados
1. **E-mail desnecessário**: o pessoal vê o e-mail tarde; você quer remover
2. **Som não funciona**: o arquivo `notification.mp3` não existe
3. **O popup card já existe** mas pode não estar aparecendo de forma clara o suficiente — posição no canto inferior, sem destaque visual forte

### O que vou implementar

**1. Remover notificação por e-mail de mensagens internas**
- Em `src/hooks/useMessaging.tsx`, remover o bloco que chama `sendNewMessageEmail` (linhas 283-299) e a importação do hook `useEmailNotification`

**2. Adicionar som de notificação real**
- Gerar um arquivo de som curto de notificação (tom de sino, ~0.5s) via script e colocá-lo em `public/notification.mp3`
- O hook `useMessageNotifications` já referencia esse arquivo; basta o arquivo existir

**3. Melhorar visibilidade do card de notificação**
- Mover o `MessagePopupDialog` para posição superior direita (mais visível, estilo Teams)
- Adicionar borda colorida (borda esquerda azul/primary) para destaque
- Aumentar levemente o tamanho do card
- Adicionar animação de entrada mais chamativa (slide da direita + leve bounce)
- Reduzir auto-dismiss para ~15 segundos (suficiente para ver, sem atrapalhar)
- Quando popup está desabilitado, o toast fallback já existe — melhorar sua duração e posição também

**4. Garantir que a notificação nativa + som disparem juntas**
- Verificar que o fluxo `showNotification` está acionando som + popup + native notification de forma consistente
- Aumentar volume do som para 0.5 (estava 0.3)

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useMessaging.tsx` | Remover envio de e-mail para mensagens |
| `src/hooks/useMessageNotifications.tsx` | Ajustar volume do som |
| `src/components/MessagePopupDialog.tsx` | Melhorar posição, estilo e animação do card |
| `public/notification.mp3` | Criar arquivo de som de notificação |


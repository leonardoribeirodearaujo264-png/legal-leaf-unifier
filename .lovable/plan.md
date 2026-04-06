
## Corrigir favicon e reforçar o alerta na aba do navegador

### Diagnóstico
- O contador em tempo real já funciona no título da aba, mas o ícone base usado pelo código continua sendo `/favicon.ico`.
- Pelo comportamento atual e pelos arquivos do projeto, esse ícone não é o branding correto do Egg Nunes; a arte da marca já existe em `public/logo-eggnunes.png`.
- O badge desenhado no favicon ainda está pequeno demais para leitura confortável na aba.

### Implementação
1. **Restaurar a favicon correta**
   - Em `index.html`, parar de usar o ícone atual e apontar explicitamente para a arte da marca do Egg Nunes, com URL versionada para forçar atualização no navegador.
   - Dar um `id` ao `<link rel="icon">` para o hook atualizar sempre o link certo.
   - Remover ou substituir o `public/favicon.ico` atual para impedir que o navegador continue puxando o ícone antigo por cache/padrão.

2. **Corrigir o badge dinâmico**
   - Em `src/hooks/useMessageNotifications.tsx`, desenhar o badge sobre a favicon correta da marca, não sobre `/favicon.ico`.
   - Aumentar bastante o badge: canvas maior, círculo maior, fonte mais grossa e melhor contraste.
   - Mostrar no favicon apenas algo legível em aba pequena (`1–9` e `9+`), enquanto o número exato continua aparecendo no título da aba.
   - Quando zerar as não lidas, restaurar a favicon original do Egg Nunes.

3. **Reforçar o alerta fora da favicon**
   - Como a área nativa da aba só permite favicon e título, reforçar o alerta também no `document.title`.
   - Trocar o formato atual por algo mais visível, como `[3] Intranet Egg Nunes` ou `● 3 Intranet Egg Nunes`, mantendo atualização em tempo real.

4. **Ajuste de consistência**
   - Alinhar também o ícone das notificações nativas de mensagem para a mesma arte da marca, evitando qualquer aparição do ícone do Lovable.

### Arquivos / itens a ajustar
- `index.html`
- `src/hooks/useMessageNotifications.tsx`
- `public/favicon.ico` (remover ou substituir)
- opcional de consistência: `src/hooks/useTaskNotifications.tsx`

### Resultado esperado
- A aba volta a mostrar a identidade visual do Egg Nunes.
- O badge fica realmente legível.
- O alerta continua em tempo real.
- Mesmo quando a favicon ficar pequena demais no navegador, o contador continuará claro no título da aba.

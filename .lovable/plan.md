
## Corrigir abertura das conversas no fim do chat interno

### Diagnóstico
- O erro está no front de `src/pages/Mensagens.tsx`.
- Hoje o auto-scroll roda quando `messages` muda, mas nesse momento a conversa ainda pode estar em `loadingMessages`.
- Na prática, o scroll acontece enquanto o componente ainda mostra o loader; quando as mensagens reais aparecem, o viewport fica no topo.
- Também falta resetar corretamente o controle de “primeira carga” ao trocar de conversa.

### O que vou implementar
1. **Reescrever o auto-scroll da conversa**
- Criar um helper único para rolar o viewport real do `ScrollArea` até o fim.
- Fazer o scroll usando o viewport do Radix (`scrollTop = scrollHeight`), não apenas confiar no fluxo atual.

2. **Acionar o scroll no momento certo**
- Rodar o auto-scroll quando:
  - a conversa ativa mudar;
  - o carregamento da conversa terminar;
  - novas mensagens forem adicionadas na conversa aberta.
- Garantir isso só depois de o DOM estar renderizado, para não cair no topo por causa do loader.

3. **Resetar estado entre conversas**
- Resetar o controle interno de contagem/primeira carga ao abrir outra conversa.
- Evitar reaproveitar a posição de scroll da conversa anterior.

4. **Preservar o comportamento esperado**
- Ao abrir a conversa: mostrar a última mensagem.
- Ao enviar/receber nova mensagem: continuar rolando para baixo automaticamente.
- Se o usuário quiser ler mensagens antigas, poderá subir manualmente.

### Detalhe técnico
- Arquivo principal: `src/pages/Mensagens.tsx`
- Ajuste secundário, se necessário: `src/hooks/useMessaging.tsx`
- Não precisa alterar banco de dados.

### Validação
- Abrir várias conversas seguidas e confirmar que sempre entra na última mensagem.
- Testar conversa longa.
- Testar envio e recebimento em tempo real.
- Validar desktop e mobile.

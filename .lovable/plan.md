

## Corrigir favicon com badge de mensagens não lidas

### Problema

1. O `index.html` tem `<link rel="icon" href="data:," />` — um favicon vazio. Isso faz o navegador mostrar o favicon padrão do Lovable.
2. O código em `useMessageNotifications.tsx` tenta carregar `/favicon.ico` como base, mas como o link no HTML aponta para `data:,`, o resultado fica inconsistente.
3. O badge vermelho usa canvas 32x32 com círculo de 14px e fonte 10px — muito pequeno para ser legível na aba do navegador.

### Correção

**1. `index.html` (linha 6)**
- Trocar `href="data:,"` por `href="/favicon.ico"` para usar o favicon real que já existe em `public/favicon.ico`

**2. `src/hooks/useMessageNotifications.tsx` (linhas 323-386)**
- Aumentar o canvas para 64x64 para melhor resolução
- Aumentar o badge vermelho de 14px para 28px de diâmetro
- Aumentar a fonte do número de 10px para 20px bold
- Posicionar o badge no canto superior direito com mais destaque
- No `img.src`, usar `/favicon.ico` (consistente com o HTML corrigido)
- No restore (linha 383), restaurar para `/favicon.ico`

### Resultado
- A favicon original do Egg Nunes aparecerá corretamente
- O badge vermelho será grande e legível
- Atualização em tempo real já funciona (o `unreadCount` é reativo via Realtime)


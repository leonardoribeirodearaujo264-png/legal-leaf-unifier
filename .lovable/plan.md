

## Três melhorias nas Mensagens Internas

### 1. Nome do colaborador cortado na lista de conversas

**Causa**: A coluna da lista tem `md:max-w-[320px]` e o nome usa `truncate`, mas compete com a data na mesma linha (`flex justify-between`). Nomes longos ficam cortados.

**Correção em `src/pages/Mensagens.tsx`** (linhas 1283-1354):
- Aumentar a largura da lista de `320px` para `360px`
- Mover a data para baixo do nome (junto com o preview), liberando espaço horizontal para o nome completo
- Permitir que o nome ocupe até 2 linhas com `line-clamp-2` em vez de `truncate`

### 2. Badge de mensagens não lidas por conversa

**Situação atual**: Já existe um badge de unread (linha 1366), mas ele fica espremido ao lado do preview da mensagem e pode não ser visível.

**Correção em `src/pages/Mensagens.tsx`**:
- Mover o badge de não lidas para ao lado do nome (mais visível)
- Dar destaque visual ao badge com cor de fundo mais forte (vermelho ou primary)
- Destacar o nome em negrito bold quando houver mensagens não lidas
- Adicionar estilo visual diferenciado na conversa inteira quando há não lidas (fundo levemente colorido)

### 3. Contador de não lidas na aba do navegador (favicon + title)

**Implementação**: Criar um hook `useDocumentTitleNotification` ou adicionar lógica ao `useMessageNotifications` existente.

**Alterações em `src/hooks/useMessageNotifications.tsx`**:
- Adicionar `useEffect` que monitora `unreadCount`
- Quando `unreadCount > 0`: atualizar `document.title` para `(5) Intranet Egg Nunes` e trocar o favicon por um com badge vermelho gerado via canvas
- Quando `unreadCount === 0`: restaurar título e favicon originais
- O Realtime já está configurado — o `unreadCount` já atualiza em tempo real, então o title/favicon acompanharão automaticamente

**Lógica do favicon dinâmico**:
```typescript
// Gerar favicon com badge via canvas
const canvas = document.createElement('canvas');
canvas.width = 32; canvas.height = 32;
const ctx = canvas.getContext('2d');
// Desenhar círculo vermelho + número branco
// Aplicar como favicon via link[rel="icon"]
```

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/Mensagens.tsx` | Aumentar largura da lista, reorganizar layout do nome/data, destacar conversas com não lidas |
| `src/hooks/useMessageNotifications.tsx` | Adicionar efeito para atualizar document.title e favicon com contador de não lidas |


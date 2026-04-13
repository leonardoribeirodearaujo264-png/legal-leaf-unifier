

## Correções nas Mensagens Internas

### Problema 1: Cursor perde foco após enviar mensagem com Enter
O `Textarea` de digitação não tem uma `ref` associada. Após o `handleSend` limpar o texto (`setNewMessage('')`), o foco sai do campo. Solução: criar um `textareaRef`, atribuir ao `Textarea`, e ao final do `handleSend`, chamar `textareaRef.current?.focus()`.

### Problema 2: Destinatário consegue editar mensagem do remetente
A função `canEditMessage` (linha 627) permite que admins/sócios editem **qualquer** mensagem. Isso está errado — edição deve ser restrita apenas ao autor da mensagem. Solução: remover a permissão de admin/sócio para editar mensagens alheias, mantendo apenas a verificação `msg.sender_id === user?.id`.

### Alterações no arquivo

**`src/pages/Mensagens.tsx`**:

1. Adicionar `const textareaRef = useRef<HTMLTextAreaElement>(null)` junto aos outros refs
2. No `handleSend`, após `setNewMessage('')`, adicionar `setTimeout(() => textareaRef.current?.focus(), 50)`
3. Atribuir `ref={textareaRef}` no `Textarea` de digitação (linha ~2109)
4. Na função `canEditMessage` (linha 627-634): remover o bloco que permite admin/sócio editar qualquer mensagem — apenas o autor pode editar suas próprias mensagens dentro de 6 horas


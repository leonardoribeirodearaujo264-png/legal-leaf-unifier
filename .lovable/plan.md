

## Adicionar Emoji Picker nas Mensagens Internas e WhatsApp

### Visão geral
Instalar uma biblioteca de emoji picker e adicionar um botão de emoji ao lado dos campos de texto em ambas as áreas de mensagem.

### Biblioteca
Usar `emoji-mart` (v5) — picker completo, leve, com busca e categorias. Pacotes: `@emoji-mart/data` e `@emoji-mart/react`.

### Alterações

**1. Instalar dependências**
- `@emoji-mart/data` e `@emoji-mart/react`

**2. Criar componente reutilizável `src/components/EmojiPicker.tsx`**
- Botão com ícone `Smile` (lucide)
- Ao clicar, abre um `Popover` com o picker do emoji-mart
- Prop `onEmojiSelect(emoji: string)` para inserir no texto
- Configurar locale pt-BR e tema automático (dark/light)

**3. `src/pages/Mensagens.tsx` — Mensagens Internas**
- Importar `EmojiPicker`
- Adicionar ao lado dos botões existentes (entre o textarea e o botão de anexo)
- `onEmojiSelect` insere o emoji na posição do cursor no textarea (`newMessage`)

**4. `src/components/whatsapp/MessageInput.tsx` — WhatsApp Avisos**
- Importar `EmojiPicker`
- Adicionar ao lado do botão de anexo
- `onEmojiSelect` insere o emoji na posição do cursor no textarea (`text`)

**5. `src/components/whatsapp/InternalCommentInput.tsx` — Comentários internos do WhatsApp**
- Mesmo tratamento: adicionar o `EmojiPicker` ao lado do textarea

### Lógica de inserção
Inserir o emoji na posição atual do cursor (`selectionStart`), não apenas no final do texto. Após inserir, reposicionar o cursor após o emoji.

### Arquivos modificados
- `package.json` — novas dependências
- `src/components/EmojiPicker.tsx` — novo componente
- `src/pages/Mensagens.tsx` — botão emoji
- `src/components/whatsapp/MessageInput.tsx` — botão emoji
- `src/components/whatsapp/InternalCommentInput.tsx` — botão emoji


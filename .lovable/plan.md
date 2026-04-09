

## Corrigir edição de mensagens internas

### Problema

A função `editMessage` tenta atualizar a coluna `is_edited` na tabela `messages`, mas essa coluna **não existe** no banco de dados. Isso causa erro ao tentar salvar a edição.

Colunas atuais da tabela `messages`: `id`, `conversation_id`, `sender_id`, `content`, `created_at`, `updated_at`, `reply_to_id` — sem `is_edited`.

### Solução

**1. Migration SQL — Adicionar coluna `is_edited`**

```sql
ALTER TABLE public.messages ADD COLUMN is_edited BOOLEAN DEFAULT false;
```

**2. Corrigir `src/hooks/useMessaging.tsx`**

Nenhuma alteração necessária no código — a lógica já está correta, só faltava a coluna no banco.

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar coluna `is_edited` à tabela `messages` |


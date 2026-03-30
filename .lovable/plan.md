

## Adicionar funcionalidades do Uselaw que faltam aqui

Comparei os dois projetos em detalhe. Este projeto ja tem: conversas individuais e grupo, audio, templates, anexos, reply-to, editar/excluir, gerenciamento de grupo, IA para gerar mensagem, pop-up de resposta rapida, banner de nao lidas, notificacoes nativas, e useStartConversation.

Faltam **duas funcionalidades** que o Uselaw tem e este projeto nao:

### 1. Favoritar mensagens (Star)
Permitir que o usuario marque mensagens como favoritas (estrela) e filtre para ver apenas as favoritas.

- **Migracao SQL**: Criar tabela `message_favorites` com colunas `id`, `user_id`, `message_id`, `created_at` e constraint unique em `(user_id, message_id)`. RLS para o proprio usuario.
- **Mensagens.tsx**: Adicionar estados `favorites` (Set), `showFavorites` (boolean). Carregar favoritos do usuario ao montar. Adicionar botao de estrela em cada mensagem (hover action). Botao no header do chat para filtrar so favoritas. Quando `showFavorites` esta ativo, filtra `messages` para mostrar so as que estao no Set.

### 2. Busca dentro da conversa
Permitir buscar texto nas mensagens da conversa ativa.

- **Mensagens.tsx**: Adicionar estados `messageSearchTerm` e `showMessageSearch`. Botao de lupa no header do chat que abre/fecha a barra de busca. Quando ativo, filtra `messages` pelo texto digitado (`content.toLowerCase().includes(...)`).

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Criar tabela `message_favorites` com RLS |
| `src/pages/Mensagens.tsx` | Adicionar favoritos (load, toggle, filtro) + busca dentro da conversa (search bar, filtro) + botoes no header (Star, Search) |

### Detalhes tecnicos

**Tabela `message_favorites`:**
```sql
CREATE TABLE public.message_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, message_id)
);
ALTER TABLE public.message_favorites ENABLE ROW LEVEL SECURITY;
-- Politicas: usuario ve/insere/deleta apenas seus proprios favoritos
```

**Logica no Mensagens.tsx:**
- `toggleFavorite(messageId)`: Se ja esta no Set, deleta do banco e remove do Set. Senao, insere no banco e adiciona ao Set.
- Filtro combinado: quando `showFavorites` e `messageSearchTerm` estao ativos simultaneamente, aplica ambos os filtros.
- Botoes adicionados no header do chat (ao lado do gerenciamento de grupo): icone Search e icone Star.
- Icone Star em cada mensagem no hover (junto com Reply, Edit, Delete).


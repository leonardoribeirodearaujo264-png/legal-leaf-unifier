

## Cadastrar novo cliente pela intranet + campo Origem + edição completa

### Resumo

Adicionar botão "Novo Cliente" na aba Contatos que abre um formulário completo com todos os campos do ADVBox (incluindo Origem). Ao salvar, o cliente é criado no ADVBox via API (`POST /customers`) e também salvo localmente na tabela `advbox_customers`. Além disso, adicionar o campo "Origem" à visualização e edição de contatos existentes.

### Alterações

**1. Migration — Adicionar coluna `origem` à tabela `advbox_customers`**

A API do ADVBox retorna o campo `origin` para cada cliente, mas não temos coluna dedicada. Adicionar:
- `origem TEXT` — armazena a origem do cliente (ex: "Instagram", "Indicação", etc.)

**2. Atualizar `supabase/functions/sync-advbox-customers/index.ts`**

Mapear o campo `origin` da API para a nova coluna `origem` durante a sincronização.

**3. Criar action `create-customer` no `advbox-integration/index.ts`**

Novo case no switch que:
- Recebe todos os campos do formulário
- Faz `POST /customers` na API do ADVBox
- Salva o cliente retornado localmente em `advbox_customers`
- Retorna o ID criado

**4. Atualizar `src/pages/ContatosAdvbox.tsx`**

- Adicionar botão "Novo Cliente" ao lado da busca
- Criar Dialog de cadastro com todos os campos organizados por seção (Dados Pessoais, Documentos, Endereço, Contato, Outros), incluindo campo "Origem" como select
- Buscar origens disponíveis do ADVBox via `advbox-integration/settings` (que já retorna `customers_origins`)
- Ao salvar, chamar `create-customer` na edge function
- Adicionar campo "Origem" ao EDITABLE_FIELDS para que apareça na visualização e edição de contatos existentes

### Fluxo do cadastro

1. Usuário clica "Novo Cliente"
2. Dialog abre com formulário completo (nome obrigatório, demais opcionais)
3. Seleciona Origem de uma lista (buscada do ADVBox)
4. Clica "Cadastrar"
5. Edge function cria no ADVBox via `POST /customers` e salva localmente
6. Novo contato aparece na lista

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar coluna `origem` |
| `supabase/functions/sync-advbox-customers/index.ts` | Mapear campo `origin` |
| `supabase/functions/advbox-integration/index.ts` | Novo case `create-customer` |
| `src/pages/ContatosAdvbox.tsx` | Botão + Dialog de cadastro + campo Origem na visualização/edição |


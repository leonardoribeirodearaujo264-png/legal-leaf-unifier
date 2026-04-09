

## Criar aba "Contatos" no ADVBox com sub-aba de Aniversários

### Resumo

Criar uma nova página `/contatos-advbox` que centraliza todos os 10.426 contatos do ADVBox, com busca por nome/telefone/CPF/CNPJ/e-mail, card detalhado ao clicar, e incorpora a funcionalidade de aniversários existente como sub-aba.

### Alterações

**1. Nova página `src/pages/ContatosAdvbox.tsx`**

Página com duas abas (Tabs):
- **Contatos** — Lista paginada dos contatos da tabela `advbox_customers` com:
  - Campo de busca unificado (nome, telefone, CPF, CNPJ, e-mail)
  - Lista em cards compactos mostrando nome, telefone, e-mail
  - Paginação client-side com busca server-side (query no Supabase com `ilike` e `or`)
  - Ao clicar em um contato, abre Dialog/Sheet lateral com card completo: nome, CPF/CNPJ, e-mail, telefone, data de nascimento
  - Limite de 50 resultados por busca para performance (10k+ registros)
- **Aniversários** — Renderiza o componente `AniversariosClientes` existente (extraído como componente reutilizável)

**2. Refatorar `src/pages/AniversariosClientes.tsx`**

Extrair o conteúdo principal (sem o `<Layout>`) para um componente `AniversariosClientesContent` exportado separadamente, para ser reutilizado dentro da nova página de Contatos como sub-aba.

**3. Atualizar `src/lib/menuData.ts`**

- Substituir o item "Aniversários Clientes" (`/aniversarios-clientes`) por "Contatos ADVBox" (`/contatos-advbox`) com ícone `Users` no grupo "Produção Jurídica"

**4. Atualizar `src/App.tsx`**

- Adicionar rota `/contatos-advbox` apontando para `ContatosAdvbox`
- Manter `/aniversarios-clientes` como redirect para `/contatos-advbox?tab=aniversarios`
- Manter `/historico-mensagens-aniversario` redirecionando para `/contatos-advbox?tab=aniversarios&subtab=historico`

**5. Atualizar `src/hooks/useAccessTracking.tsx`**

- Adicionar entrada para `/contatos-advbox`

### Estrutura da busca

A busca consultará `advbox_customers` com:
```sql
SELECT * FROM advbox_customers
WHERE name ILIKE '%termo%'
   OR phone ILIKE '%termo%'
   OR cpf ILIKE '%termo%'
   OR cnpj ILIKE '%termo%'
   OR tax_id ILIKE '%termo%'
   OR email ILIKE '%termo%'
ORDER BY name
LIMIT 50
```

### Card do contato (Dialog)

Exibirá: nome completo, CPF, CNPJ, tax_id, e-mail, telefone, data de nascimento, data da última sincronização.




## Correções e Adaptações do CRM — 3 Problemas Reportados

### Problema 1: Busca por telefone parcial não funciona

**Causa raiz**: A busca no CRM funciona com `contact.phone?.includes(search)`, o que deveria funcionar para substrings. Porém, o telefone pode estar armazenado com formatação `(11) 99999-9999` e o usuário digita `99999` sem formatação, ou vice-versa. A busca do Kanban (oportunidades) nem sequer busca por telefone — só busca por nome, contato e produto.

**Correção**:
- **CRMContactsList.tsx** (filtro ~linha 306): Normalizar tanto o telefone armazenado quanto o termo de busca, removendo caracteres não numéricos antes de comparar
- **CRMDealsKanban.tsx** (filtro ~linha 506 e ~linha 1019): Adicionar busca por telefone do contato (normalizado) e email do contato no filtro de oportunidades

### Problema 2: Ao criar lead, não vincula a uma oportunidade

**Causa raiz**: O dialog "Novo Lead" (linha 1128-1186 do CRMContactsList) cria apenas o registro em `crm_contacts`, sem opção de criar uma oportunidade (deal) simultaneamente.

**Correção em `CRMContactsList.tsx`**:
- Adicionar ao form de "Novo Lead" os campos opcionais:
  - **Criar oportunidade**: Checkbox para ativar
  - **Produto**: Select com produtos existentes ou campo livre
  - **Valor**: Campo numérico
  - **Responsável**: Select com os responsáveis comerciais (Daniel, Lucas)
- Ao submeter, se checkbox ativo, criar automaticamente um `crm_deal` vinculado ao contato criado, na primeira etapa do pipeline ("Recepção/apresentação", id `16a09c94-...`)

### Problema 3: Substituir responsável pelo lead/oportunidade

**Causa raiz**: Não existe UI para alterar o `owner_id` de uma oportunidade. O campo "Responsável" é exibido apenas como texto no detalhe do deal.

**Correção em `CRMDealsKanban.tsx`**:
- No painel de detalhes da oportunidade (~linha 1167), substituir o texto estático por um `Select` que lista os responsáveis comerciais (buscados da tabela `profiles` com posição comercial)
- Ao alterar, gravar no `crm_deals` o novo `owner_id` + registrar no `crm_deal_history` uma entrada com `notes` descrevendo a mudança (ex: "Responsável alterado de Daniel para Lucas por [nome do usuário]")
- Exibir toast de confirmação

### Arquivos modificados
- `src/components/crm/CRMContactsList.tsx` — normalizar busca por telefone + campos de oportunidade no "Novo Lead"
- `src/components/crm/CRMDealsKanban.tsx` — adicionar telefone/email na busca + select de responsável com histórico

### Sem migração necessária
Todas as tabelas e colunas já existem (`crm_deals.owner_id`, `crm_deal_history`).


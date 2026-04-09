

## Adicionar dialog de detalhes e edição nos adiantamentos

### Problema

Ao clicar num adiantamento na tabela, não há como visualizar todos os dados preenchidos (conta de pagamento, forma de desconto, mês de início, observações) nem editá-los. A tabela mostra apenas um resumo.

### Solução

Adicionar um dialog de detalhes/edição que abre ao clicar na linha do adiantamento, exibindo todos os campos e permitindo edição.

### Alterações em `src/components/rh/RHAdiantamentos.tsx`

**1. Novo state para dialog de detalhes**
- `detailDialogOpen` + `editMode` boolean
- Ao abrir, preencher os campos do formulário com os dados do adiantamento selecionado

**2. Dialog de detalhes completo**
Exibe todos os campos em modo leitura:
- Colaborador, Tipo, Valor, Data, Conta de pagamento (nome), Forma de desconto, Número de parcelas, Valor por parcela, Mês de início do desconto, Observações, Status, Saldo restante

Botão "Editar" que ativa modo de edição nos campos editáveis (tipo, valor NÃO — pois já gerou lançamento financeiro, mas observações, forma de desconto, mês de início sim).

Campos editáveis: observações, mês de início do desconto, número de parcelas (recalcula valor parcela). Tipo e valor não devem ser editáveis pois já geraram lançamento financeiro.

**3. Tornar as linhas da tabela clicáveis**
Adicionar `cursor-pointer hover:bg-muted/50` no `TableRow` com `onClick` que abre o dialog de detalhes.

**4. Botão "Salvar" na edição**
Faz `update` na tabela `rh_adiantamentos` com os campos alterados e recarrega os dados.

### Arquivo alterado

| Arquivo | Ação |
|---------|------|
| `src/components/rh/RHAdiantamentos.tsx` | Adicionar dialog de detalhes com visualização completa + modo edição |

Nenhuma alteração no banco de dados.


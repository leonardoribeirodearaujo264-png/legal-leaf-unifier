

## Adicionar rateio ao dialog de edição de pagamento

### Problema

O dialog de edição de pagamento (`editDialogOpen`) não inclui a seção de rateio financeiro. Na criação, existe a opção "Usar Rateio?" com conta de saída e divisão por categorias. Na edição, essa seção está completamente ausente — só aparecem rubricas, datas e status.

### Correção

**Arquivo: `src/components/rh/RHPagamentos.tsx`**

1. **Adicionar estados de edição para rateio** (após linha 162):
   - `editUsarRateio`, `editContaId`, `editRateios`, `editRateioDisplayValues`, `editRateioDisplayPct`

2. **Carregar dados de rateio existentes no `handleEditPagamento`** (linha 926):
   - Buscar lançamentos financeiros vinculados ao pagamento (`fin_lancamentos` onde `descricao` contém o nome do colaborador e `data_lancamento` = data do pagamento)
   - Se encontrar múltiplos lançamentos com categorias diferentes, popular os estados de rateio
   - Carregar a conta de origem do lançamento existente

3. **Adicionar seção de rateio no dialog de edição** (após a seção de Descontos, antes dos Totais, ~linha 1683):
   - Separador + bloco "Lançar no Financeiro" com select de conta e switch de rateio
   - Reutilizar a mesma UI de rateio da criação (categoria, %, valor, botão adicionar/remover)
   - Usar `calcularTotaisEdit().liquido` como base para o cálculo de percentual

4. **Atualizar `handleSaveEdit`** (linha 1013):
   - Após salvar rubricas, deletar lançamentos financeiros antigos vinculados
   - Se `editUsarRateio` e `editContaId` estão preenchidos, criar novos lançamentos por categoria (rateio)
   - Se não usar rateio mas tem conta, criar lançamento único
   - Mesma lógica que já existe na criação (linhas 567-610)

### Resultado
- Ao editar um pagamento, aparecerá a seção de lançamento financeiro com opção de rateio
- Será possível adicionar, alterar ou remover o rateio de um pagamento existente


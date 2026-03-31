

## Permitir edição de pagamentos já marcados como "pago"

### Problema

No arquivo `ParceiroDetalhes.tsx`, linha 510, os botões de ação (editar e marcar como pago) só aparecem quando `isPendente` é `true` (`status !== 'pago'`). Quando o pagamento está com status "pago", os botões desaparecem completamente — impedindo qualquer edição posterior.

Além disso, o `EditarParcelaDialog` não tem campo para editar `data_pagamento` nem `status`, então mesmo que o botão aparecesse, não seria possível corrigir a data de pagamento.

### Correções

**1. `ParceiroDetalhes.tsx` — Mostrar botão de editar para pagamentos pagos**

Mover o botão "Editar parcela" (Pencil) para fora do bloco `{isPendente && (...)}`, de modo que ele apareça sempre, independente do status. Apenas o botão "Marcar como pago" (CheckCircle2) deve ficar restrito a pagamentos pendentes.

**2. `EditarParcelaDialog.tsx` — Adicionar campos de data de pagamento e status**

- Adicionar `data_pagamento` e `status` à interface `Pagamento`
- Adicionar campo de input para "Data de Pagamento" no formulário
- Adicionar select para alterar o status (pago/pendente)
- Incluir `data_pagamento` e `status` no UPDATE enviado ao banco

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/components/parceiros/ParceiroDetalhes.tsx` | Mover botão Editar para fora do `{isPendente && ...}` |
| `src/components/parceiros/EditarParcelaDialog.tsx` | Adicionar campos `data_pagamento` e `status` no formulário e no UPDATE |


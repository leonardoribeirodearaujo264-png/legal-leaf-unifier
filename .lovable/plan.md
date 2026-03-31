

## Corrigir erro "column observacao does not exist" nos pagamentos de parceiros

### Causa raiz

A trigger `sync_parceiro_pagamento_to_financeiro` usa o nome de coluna `observacao` em dois lugares, mas a coluna real na tabela `fin_lancamentos` se chama `observacoes` (com "s" no final).

Isso impede QUALQUER criação de pagamento de parceiro, pois a trigger dispara automaticamente e falha.

### Correção

Uma única migração SQL para recriar a função `sync_parceiro_pagamento_to_financeiro` com o nome correto da coluna:

**Linha 1 (UPDATE):** Trocar `observacao` por `observacoes`:
```sql
-- DE:
observacao = COALESCE(NEW.descricao_abatimentos, observacao),
-- PARA:
observacoes = COALESCE(NEW.descricao_abatimentos, observacoes),
```

**Linha 2 (INSERT):** Trocar `observacao` por `observacoes`:
```sql
-- DE:
observacao,
-- PARA:
observacoes,
```

Nenhuma alteração de código frontend é necessária. Apenas a função do banco precisa ser corrigida.


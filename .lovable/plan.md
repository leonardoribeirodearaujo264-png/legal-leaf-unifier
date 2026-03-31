

## Corrigir "Erro ao marcar como pago" nos pagamentos de parceiros

### Causa raiz

Há **dois problemas graves** no banco de dados:

1. **Recursão infinita de triggers**: Quando o usuário marca um pagamento como "pago" em `parceiros_pagamentos`, o trigger `sync_parceiro_pagamento_to_financeiro` atualiza `fin_lancamentos`. Isso dispara o trigger `sync_financeiro_to_parceiro_pagamento` em `fin_lancamentos`, que tenta atualizar `parceiros_pagamentos` de volta — criando um loop infinito até o PostgreSQL abortar com erro.

2. **Trigger duplicado**: Existem DOIS triggers (`sync_parceiro_pagamento_trigger` e `trigger_sync_parceiro_pagamento`) chamando a mesma função na tabela `parceiros_pagamentos`, fazendo a sincronização rodar duas vezes.

```text
Fluxo atual (loop infinito):

User UPDATE parceiros_pagamentos (status='pago')
  → BEFORE trigger: sync_parceiro_pagamento_to_financeiro
    → UPDATE fin_lancamentos (status='pago')
      → AFTER trigger: sync_financeiro_to_parceiro_pagamento
        → UPDATE parceiros_pagamentos (status='pago')
          → BEFORE trigger: sync_parceiro_pagamento_to_financeiro
            → UPDATE fin_lancamentos ...
              → ... LOOP até crash
```

### Correção (uma única migração SQL)

1. **Remover o trigger duplicado** (`trigger_sync_parceiro_pagamento`)
2. **Adicionar guarda de recursão** em ambas as funções usando `pg_trigger_depth() < 2` para quebrar o loop

```sql
-- 1) Drop trigger duplicado
DROP TRIGGER IF EXISTS trigger_sync_parceiro_pagamento ON parceiros_pagamentos;

-- 2) Adicionar guarda na função sync_financeiro_to_parceiro_pagamento
CREATE OR REPLACE FUNCTION sync_financeiro_to_parceiro_pagamento()
  ...
  IF pg_trigger_depth() < 2 THEN
    -- só executa se não estiver em recursão
    UPDATE parceiros_pagamentos SET ...
  END IF;
  ...

-- 3) Adicionar guarda na função sync_parceiro_pagamento_to_financeiro
CREATE OR REPLACE FUNCTION sync_parceiro_pagamento_to_financeiro()
  ...
  IF pg_trigger_depth() < 2 THEN
    UPDATE fin_lancamentos SET ...
  END IF;
  ...
```

3. **Melhorar mensagem de erro no frontend** (`ParceiroDetalhes.tsx`): mostrar o erro real do banco em vez do genérico "Erro ao marcar como pago"

### Resultado
- Marcar parcela como paga funcionará sem erro
- A sincronização bidirecional continua operando, mas sem loop infinito
- O trigger duplicado será removido




## Implementar gaps da integração ADVBox (comparação com outra cliente)

Após comparação detalhada, a maioria das melhorias da outra cliente **já está implementada** no seu sistema. Restam 5 gaps reais a corrigir:

### O que já está implementado (sem ação necessária)
- Cache persistente `/settings` com TTL 24h
- `create-movement` usando `POST /lawsuits/movement` (endpoint correto)
- Filtros server-side de processos, tarefas e movimentações
- `complete-task` retorna erro informativo (limitação da API)
- Mapeamento correto de campos de cliente (identification, document, CEP com hífen)
- Endpoints `update-lawsuit`, `update-transaction`, `create-transaction`, `task-history`
- Delay de 2000ms na `advbox-integration`
- Parâmetro `month` nos aniversariantes

### Gaps a corrigir

**1. Remover `update-task` fantasma (linha 1767)**
O case `update-task` chama `PUT /posts/{id}` que **não existe** na API. Deve retornar erro informativo (igual ao `complete-task`) em vez de tentar chamar um endpoint inexistente.

**2. Ajustar delays nas sync functions para 2100ms**
- `sync-advbox-tasks`: 1500ms → 2100ms
- `sync-advbox-customers`: 300ms → 2100ms
- `sync-advbox-status`: 500ms → 2100ms
- `sync-advbox-financial`: 500ms entre batches → 2100ms

**3. Filtro `origin` no endpoint de movimentações por processo**
O case `movements` (linha 1122) não aceita `?origin=TRIBUNAL|MANUAL`. Adicionar suporte a esse parâmetro e tratar resposta 204 (sem dados).

**4. Validações financeiras usando settings**
Na criação de transações (`create-transaction`), validar:
- `entry_type="income"` aceita apenas categorias tipo CRÉDITO
- `entry_type="expense"` aceita apenas categorias tipo DÉBITO
- `date_payment` não pode ser data futura
- `amount` deve ser > 0

**5. Validações de frontend nos formulários ADVBox**
- CPF/CNPJ com algoritmo real
- Pasta do processo máximo 30 caracteres
- `end_time` requer `end_date`

### Arquivos modificados
- `supabase/functions/advbox-integration/index.ts` — corrigir update-task, adicionar origin filter, validações financeiras
- `supabase/functions/sync-advbox-tasks/index.ts` — delay 2100ms
- `supabase/functions/sync-advbox-customers/index.ts` — delay 2100ms
- `supabase/functions/sync-advbox-status/index.ts` — delay 2100ms
- `supabase/functions/sync-advbox-financial/index.ts` — delay 2100ms




## Implementar gaps da integração ADVBox + verificar cache de settings

### Diagnóstico

1. **Cache de settings vazio**: A tabela `advbox_settings_cache` tem 0 registros — o cache nunca foi populado porque nenhuma chamada ao endpoint `settings` foi feita ainda (ou a função não foi re-deployada após a última atualização).

2. **Gaps identificados na edge function**:
   - `case 'tasks'`: busca `/posts` sem filtros `completed_start/end`, `deadline_start/end`
   - `case 'customer-birthdays'`: chama `/customers/birthdays` sem parâmetro `month`
   - `case 'create-task'`: não envia `display_schedule`
   - `case 'create-transaction'`: não aceita `competence` (MM/YYYY)
   - `case 'lawsuits-recent'`: filtra client-side em vez de usar filtros server-side da API

### Alterações

**Arquivo: `supabase/functions/advbox-integration/index.ts`**

1. **Tasks com filtros avançados** (case `tasks`, ~linha 1236):
   - Aceitar query params `completed_start`, `completed_end`, `deadline_start`, `deadline_end`
   - Quando fornecidos, construir endpoint `/posts?completed_start=DD/MM/YYYY&completed_end=...` em vez de buscar tudo
   - Manter o comportamento atual (sem filtros = busca completa) como fallback

2. **Aniversariantes com mês** (case `customer-birthdays`, ~linha 1143):
   - Aceitar query param `month` (1-12)
   - Quando fornecido, chamar `/customers/birthdays?month={month}`

3. **display_schedule na criação de tarefa** (case `create-task`, ~linha 1585):
   - Aceitar campo `display_schedule` no body e repassar à API
   - Default: não incluir (mantém comportamento atual)

4. **competence na criação de transação** (case `create-transaction`, ~linha 2337):
   - Aceitar campo `competence` (MM/YYYY) no body e repassar à API

5. **Filtros server-side em lawsuits-recent** (case `lawsuits-recent`, ~linha 666):
   - Quando disponíveis, usar parâmetros de filtro da API (`status_closure_start`, `status_closure_end`, `production_date_start`, `production_date_end`) passados como query params
   - Manter filtro client-side como fallback

6. **Popular cache de settings automaticamente** (início da função):
   - Na inicialização (primeiro request), chamar `getSettingsWithCache()` em background para garantir que o cache é populado
   - Adicionar um case `refresh-settings` para forçar atualização manual

### Resultado
- Consultas de tarefas por período (concluídas/prazo) serão server-side, reduzindo tráfego
- Aniversariantes filtráveis por mês específico
- Campos `display_schedule` e `competence` disponíveis para criação
- Cache de settings será populado automaticamente no primeiro uso


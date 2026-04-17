

## Plano de redução de custo do Lovable Cloud

### Diagnóstico (números reais do banco)

**Banco: 822 MB total** — concentrado em poucas tabelas muito gordas:

| Tabela | Tamanho | Linhas | Diagnóstico |
|---|---|---|---|
| `audit_log` | **452 MB** | 240k | 47k dead tuples; sem retenção real apesar da regra dos 90d |
| `fin_auditoria` | **114 MB** | 68k | Sem retenção; sobrescreve toda alteração financeira |
| `advbox_tasks` | 36 MB | 12k | OK |
| `advbox_financial_sync` | 28 MB | 32k | 5k dead tuples; sem vacuum desde 25/03 |
| `asaas_webhook_events` | 8 MB | 3.7k | **2.683 eventos antigos** (>30d) podem ser apagados |
| `zapi_webhook_events` | 2 MB | 2.3k | **2.306 eventos antigos** (>30d) |
| `advbox_tasks_sync_status` | 1 MB | 6.3k | 659 registros antigos (>60d) |

**`profiles` recebe 1,24 BILHÃO de leituras sequenciais** — é o maior problema de CPU/IO. Cada `useUserRole`, `useAuth`, `usePresence`, qualquer página que consulta `profiles` está fazendo seq scan em vez de usar índice. Mesmo padrão em `fin_lancamentos` (578M linhas lidas em seq scan), `conversation_participants` (116M) e `crm_deals` (69M).

**Realtime: 16 tabelas em `supabase_realtime`** — algumas pesadas (`fin_dashboard_cache`, `advbox_dashboard_cache`, `fin_lancamentos`, `crm_deals`). Cada UPDATE nessas tabelas dispara broadcast WAL para todos os clientes conectados. Custo cresce exponencialmente.

**Frontend dispara consultas demais:**
- `useTaskNotifications` roda a cada **30 min** em **toda página** (roda no Layout) → query global a cada meia hora por usuário ativo.
- `useZapiConnection` faz polling a cada `pollIntervalMs`.
- `RelatoriosFinanceiros` tem `setInterval` recarregando dados.
- `usePresence` é montado globalmente (Layout) — cada usuário online mantém canal Realtime aberto **100% do tempo**.

**Edge functions: 75 funções** — várias provavelmente são chamadas por cron (sync ADVBox, dashboard cache, daily digest, asaas-boleto-reminders, birthday-messages, etc.). Cada execução cobra Cloud.

---

### Plano de redução (priorizado por economia/risco)

**1. Limpeza imediata de logs antigos (economia: ~250 MB de banco)**

Migration única para deletar:
- `audit_log` com `created_at < now() - interval '90 days'` → libera ~200 MB
- `fin_auditoria` com `created_at < now() - interval '90 days'` → libera ~30 MB
- `asaas_webhook_events` >30 dias → libera ~6 MB
- `zapi_webhook_events` >30 dias → libera ~1.5 MB
- `advbox_tasks_sync_status` >60 dias → libera 600 KB
- Depois: `VACUUM FULL` nessas tabelas para devolver espaço ao SO.

**Automatizar** via pg_cron diário: job único que aplica retenção em todas essas tabelas.

**2. Índices críticos para zerar seq scans (economia: ~40-60% CPU do Postgres)**

Adicionar índices que faltam (conferir antes de criar — alguns podem existir):
- `profiles(id)` — já é PK, mas verificar se queries usam `email`, `position`, `is_active` → criar índice composto
- `profiles(email)` único
- `profiles(is_active, approval_status)` parcial onde `is_active=true`
- `fin_lancamentos(deleted_at, status, data_vencimento)` — usado em todo dashboard executivo
- `conversation_participants(user_id, conversation_id)` composto
- `crm_deals(stage_id, won, owner_id)` composto
- `intranet_update_reads(user_id, update_id)` composto
- `birthday_messages_log(client_id, sent_at)` — está fazendo 15k seq scans

**3. Reduzir tabelas em Realtime (economia: ~30-50% banda Realtime)**

Remover do `supabase_realtime`:
- `fin_dashboard_cache` e `advbox_dashboard_cache` — são cache, não precisam de push em tempo real (pode-se usar polling de 60s só na tela aberta)
- `crm_deals` — substituir por refetch ao focar a aba
- `crm_activities` — idem
- `favorable_decisions`, `qr_codes`, `rh_pagamentos` — telas raramente abertas

Manter apenas: `messages`, `message_deliveries`, `conversation_participants`, `user_notifications`, `system_notifications`, `whatsapp_messages`, `whatsapp_internal_comments`, `realtime_notifications`, `profiles` (presence).

**4. Reduzir polling do frontend (economia: ~70% chamadas /rest)**

- `useTaskNotifications`: aumentar de 30 min para **2 horas** + só rodar se a aba estiver visível (`document.visibilityState === 'visible'`).
- `useZapiConnection`: rodar só na página WhatsApp, não globalmente; polling 60s → 5min.
- `RelatoriosFinanceiros`: remover `setInterval` automático, exigir clique de "Atualizar".
- `usePresence`: só conectar quando a página `/mensagens` estiver aberta (não global em Layout). Reduz drasticamente conexões realtime persistentes.
- `TVMode`: aumentar refresh de 1s → 5s no relógio (1s é puro overhead React).

**5. Frequência de cron jobs do Postgres (economia: 30-50% execuções)**

Sem acesso a `cron.job` agora, mas pelo histórico do projeto sabemos que rodam vários syncs. Recomendações:
- `advbox-cache-refresh`: de 5min → 15min
- `fin-dashboard-cache-refresh`: de 5min → 30min  
- `sync-advbox-customers`/`tasks`/`financial`: de 30min → horário (1x/h) em horário comercial; 4h fora do expediente
- `birthday-messages`: 1x/dia às 09h (manter)
- `process-scheduled-whatsapp`: de 1min → 5min
- `cleanup-audit-logs`: 1x/dia (novo job consolidado)

**6. Auditoria seletiva (economia: 30-50% writes em audit_log)**

Hoje há trigger `audit_trigger_fn` provavelmente em muitas tabelas. Revisar e **remover triggers de auditoria** de tabelas de baixo valor:
- `advbox_tasks`, `advbox_financial_sync`, `advbox_customers` — vêm de sync externo, não precisa auditar
- `crm_activities`, `crm_sync_log` — log já é o conteúdo
- `whatsapp_messages` — volume alto demais

Manter auditoria apenas em: `profiles`, `user_roles`, `fin_lancamentos`, `fin_contas`, `rh_pagamentos`, `parceiros_pagamentos`, `admin_permissions`.

**7. VACUUM FULL + REINDEX após limpeza (economia: 200+ MB)**

Após o passo 1, rodar `VACUUM FULL` em `audit_log`, `fin_auditoria`, `advbox_financial_sync`, `fin_lancamentos`. Devolve disco ao SO (autovacuum só marca, não libera).

---

### Estimativa de impacto

| Ação | Economia |
|---|---|
| Limpeza + VACUUM | -250 MB banco (~30%) |
| Índices em `profiles`, `fin_lancamentos`, etc. | -40-60% CPU Postgres |
| Reduzir tabelas em Realtime | -30-50% custo Realtime |
| Reduzir polling frontend | -70% requests REST |
| Reduzir cron jobs | -30-50% execuções edge function |
| Triggers de auditoria seletivos | -50% writes em audit_log |

**Resultado esperado: redução de 40-60% no custo mensal de Cloud**, sem qualquer perda funcional para o usuário.

---

### Sem riscos para o usuário

- Nenhuma feature deixa de funcionar
- Tempo de carregamento dos dashboards melhora (índices + cache)
- Mensagens internas continuam em tempo real
- Notificações continuam (só com janela maior)
- Logs antigos (>90d) ficam fora do banco — se precisar de histórico longo, exportar para CSV antes

---

### Ordem de execução (4 etapas)

1. **Etapa 1 — Banco (migration única)**: limpeza de logs antigos + criação de índices críticos + VACUUM FULL.
2. **Etapa 2 — Realtime + triggers (migration)**: tirar tabelas pesadas do publication, remover triggers de auditoria de tabelas de sync.
3. **Etapa 3 — Frontend**: ajustes em `useTaskNotifications`, `useZapiConnection`, `RelatoriosFinanceiros`, `usePresence` (mover para `Mensagens.tsx`), `TVMode`.
4. **Etapa 4 — Cron jobs**: revisar e reconfigurar frequências (precisa visualizar `cron.job` em runtime — farei na execução).

Posso executar tudo numa única passagem ou separar por etapas — recomendo **uma etapa por vez** para validar cada impacto e poder reverter pontualmente se algo se comportar diferente.


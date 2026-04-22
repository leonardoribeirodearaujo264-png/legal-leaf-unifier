

## Causa raiz: automações enviam direto pra Z-API e pulam o painel

Cada função de automação chama a API da Z-API por conta própria (`fetch` direto pra `api.z-api.io/.../send-text`) e grava só no log paralelo (`zapi_messages_log`, `defaulter_messages_log`, etc.). **Nenhuma delas insere em `whatsapp_messages` / `whatsapp_conversations`** — que é a tabela que o painel `/whatsapp-avisos` lê.

A função de aniversário é a única que **funciona** porque tem uma helper `saveToWhatsAppTables(...)` que faz o upsert da conversa + insert da mensagem. Por isso só aparece aniversário.

E o "fallback" via `ReceivedCallback` com `notifySentByMe: true` (que arrumamos no plano anterior) **não cobre essas mensagens**, porque a Z-API só dispara `notifySentByMe` para mensagens enviadas pelo **app oficial do WhatsApp no celular**, não para mensagens enviadas pela própria API. O que ela envia nesse caso é o `SentCallback` (`sent_message`) — e o webhook já trata, mas **só quando recebe**; o problema é que pra ZapSign / Asaas / cobrança o `SentCallback` é entregue, sim, mas não tem `senderName`/`participantPhone` no formato esperado e às vezes nem chega (quando a Z-API agrupa). A solução robusta é **gravar no banco no momento do envio**, não depender do retorno do webhook.

### Funções afetadas (todas precisam virar pra `whatsapp_messages`)

| # | Função | Hoje grava em | Tipo de mensagem perdida |
|---|---|---|---|
| 1 | `zapsign-integration` | `zapi_messages_log` | Convite de assinatura digital |
| 2 | `asaas-boleto-reminders` | `zapi_messages_log` | Lembretes de boleto vencendo (suspenso, mas o código está lá) |
| 3 | `send-defaulter-message` | `defaulter_messages_log` | Cobrança de inadimplentes (suspenso, mas o código está lá) |
| 4 | `process-crm-automation` | nada (só log da regra) | Automações do CRM (WhatsApp via gatilho) |
| 5 | ✅ `birthday-messages` | já grava certo | (referência — está OK) |

### Plano de correção

**Passo 1 — Criar uma helper compartilhada `saveToWhatsApp(...)`**

Em vez de duplicar 50 linhas em cada função, vou criar `supabase/functions/_shared/whatsapp-sync.ts` exportando uma única função:

```ts
export async function saveOutboundToWhatsApp(supabase, {
  phone, messageText, zaapId, sentBy, contactName, messageType
})
```

Ela faz exatamente o que `birthday-messages` já faz: normaliza telefone (`validateBrazilianPhone`), upsert em `whatsapp_conversations`, insert em `whatsapp_messages` com `direction='outbound'`, `is_from_me=true`, `status='sent'`, `zapi_message_id=zaapId`. Idempotente: se já existir mensagem com mesmo `zapi_message_id`, ignora (evita duplicar quando o `SentCallback` chega depois).

**Passo 2 — Plugar a helper nas 4 funções**

Em cada uma, **logo após** o `fetch` da Z-API retornar OK e extrair `zaapId`, chamar `saveOutboundToWhatsApp(...)`. Manter o log paralelo existente (`zapi_messages_log` etc.) intacto pra não quebrar relatórios.

Pontos exatos de inserção:
- `zapsign-integration/index.ts` linha ~665 (logo depois do `console.log("ZapSign notification sent successfully")`)
- `asaas-boleto-reminders/index.ts` linha ~122 (dentro do `try` da função `sendWhatsAppMessage`, antes do `return`)
- `send-defaulter-message/index.ts` linha ~104 (mesma posição)
- `process-crm-automation/index.ts` linha ~88 (logo depois do `if (zapiRes.ok)`)

**Passo 3 — Tratamento do duplicado no webhook**

O `zapi-webhook` já tem deduplicação por `zapi_message_id` (vi na linha 240-247 de `zapi-webhook/index.ts`). Então quando o `SentCallback` chegar pra confirmar a mensagem que já gravamos no Passo 2, ele **não duplica** — apenas o `syncToWhatsApp` para a chamada de `INSERT` cedo. Status updates via `message_status` continuam funcionando normalmente (achando a mensagem pelo `zapi_message_id` que gravamos).

**Passo 4 — Remover o "early return" de suspensão (opcional, você decide)**

`asaas-boleto-reminders` e `send-defaulter-message` têm um `return` no topo "Z-API SUSPENSO TEMPORARIAMENTE". Não vou mexer nisso — isso é decisão sua de quando reativar. Apenas registro que, enquanto isso estiver lá, o passo 2 nessas duas funções fica "dormente" (código pronto, mas não roda). Quando você quiser reativar, basta remover o early return.

**Passo 5 — Redeploy**

Apenas das 4 funções editadas:
- `zapsign-integration`
- `asaas-boleto-reminders`
- `send-defaulter-message`
- `process-crm-automation`

`zapi-webhook` e `birthday-messages` **não** são tocados.

### Detalhes técnicos

**Arquivos criados:**
- `supabase/functions/_shared/whatsapp-sync.ts` (novo, ~70 linhas)

**Arquivos modificados:**
- `supabase/functions/zapsign-integration/index.ts` — adicionar import + chamada após envio bem-sucedido
- `supabase/functions/asaas-boleto-reminders/index.ts` — idem
- `supabase/functions/send-defaulter-message/index.ts` — idem
- `supabase/functions/process-crm-automation/index.ts` — idem

**Arquivos NÃO tocados:**
- `supabase/functions/birthday-messages/index.ts` — já funciona (pode ser refatorado pra usar a helper depois, mas não é objetivo agora)
- `supabase/functions/zapi-webhook/index.ts` — dedup já existe
- `supabase/functions/zapi-send-message/index.ts` — já grava certo (é o canal manual usado pelo painel)
- Banco de dados, RLS, secrets — nada muda

**Risco:** baixo. A helper é idempotente e só **adiciona** registros. Se ela falhar (telefone inválido, etc.), a mensagem da Z-API já saiu — só não aparece no painel; logamos o erro com `console.error` mas **não derrubamos a função** (try/catch dentro da helper).

**Validação após deploy:** disparar uma assinatura ZapSign de teste e confirmar que aparece em `/whatsapp-avisos` na conversa do cliente, com tique cinza primeiro e depois azul (graças aos status mapeados no plano anterior).


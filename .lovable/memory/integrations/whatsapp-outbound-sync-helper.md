---
name: WhatsApp Outbound Sync Helper
description: Helper compartilhado para gravar mensagens enviadas via Z-API no painel /whatsapp-avisos
type: feature
---
# WhatsApp Outbound Sync Helper

Toda Edge Function que envia mensagem via Z-API (fora do canal manual `zapi-send-message`) DEVE chamar `saveOutboundToWhatsApp` de `supabase/functions/_shared/whatsapp-sync.ts` logo após o `fetch` da Z-API retornar OK.

**Por quê:** a Z-API não dispara `notifySentByMe` para mensagens enviadas pela própria API (apenas pelo app do celular). Sem o helper, a mensagem some do painel `/whatsapp-avisos`.

**Funções que usam o helper:**
- `birthday-messages` (própria implementação local — referência)
- `zapsign-integration`
- `asaas-boleto-reminders`
- `send-defaulter-message`
- `process-crm-automation`

**Idempotência:** o helper checa `zapi_message_id` antes de inserir, então o `SentCallback` posterior do `zapi-webhook` não duplica.

**Não derruba a função chamadora:** todos os erros do helper são logados via `console.error` e silenciados — a mensagem da Z-API já foi enviada.

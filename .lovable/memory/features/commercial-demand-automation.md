---
name: commercial-demand-automation
description: A funcionalidade 'Nova Demanda' (/contatos-advbox) automatiza o fluxo entre operacional e comercial via rodízio de vendedores, integração ChatGuru e criação de tarefa no CRM. Inclui normalização de telefone BR, verificação de chat, status detalhado por etapa e logs em integration_sync_log.
type: feature
---

# Nova Demanda (Setor Comercial)

Botão "Nova Demanda" em `/contatos-advbox` cria uma demanda comercial com automações encadeadas via edge function `create-commercial-demand`.

## Fluxo

1. **Rodízio de vendedores** — round-robin entre `comercial_vendedores_config` ativos, baseado no último `vendedor_id` em `comercial_demandas`.
2. **ChatGuru** — em ordem:
   - `chat_check` → verifica se o chat existe.
   - `chat_add` (se não existir) → cria o chat com o nome do cliente.
   - `note_add` → registra observação configurável (`comercial_config.texto_observacao_chatguru`).
   - `chat_edit status=O` → marca chat como aberto.
   - `chat_edit user_id=...` → atribui responsáveis (vendedor + Marcos + setor comercial quando configurado).
3. **CRM** — cria `crm_activities` (tipo `task`) com prazo configurável (`prazo_padrao_horas`, default 48h) atribuída ao vendedor sorteado.
4. **Persistência** — `comercial_demandas` recebe `vendedor_id`, `vendedor_nome`, `chatguru_note_id`, `crm_activity_id`, `criado_por_nome`.
5. **Log de auditoria** — gravado em `integration_sync_log` (`target_table = 'chatguru+crm'`, `action = 'create_demand'`) com `chatguru_status` JSON detalhado (chat_check, chat_create, note_add, status_open, assignments, setor_comercial).

## Normalização de telefone BR

Função `normalizePhoneBR` na edge function:
- Remove caracteres não numéricos e zeros à esquerda.
- Aceita números com ou sem DDI 55.
- Valida DDD (11–99) e tamanho (10/11 dígitos sem DDI; 12/13 com DDI).
- Retorna `null` se inválido — etapa ChatGuru é pulada com mensagem clara.

## Detecção de sucesso ChatGuru

A heurística antiga (qualquer HTTP 200) mascarava falhas. Agora valida:
- `result === "OK"` ou `"ok"`, ou
- `code === 0`, `success === true`, ou
- presença de `id`/`note_id` na resposta.

## Setor Comercial

O ChatGuru **não possui** um perfil "Setor Comercial" — o `setor_comercial_chatguru_id` em `comercial_config` fica vazio por padrão.
- Quando vazio: a UI desabilita o switch "Setor Comercial" e mostra aviso amarelo. A edge function pula a etapa silenciosamente, registrando `setor_comercial: { skipped: true, reason: ... }`.
- Quando preenchido: switch reativa e a atribuição passa a ocorrer normalmente.

## Marcos (Head Comercial)

ID ChatGuru fixo em `comercial_config.marcos_chatguru_id` = `63ff69df1c00b36c82814a99`. Sempre marcado como responsável quando `marcos_obrigatorio = true` (padrão).

## Feedback ao usuário

A edge function devolve `steps_summary[]` com `{ key, label, ok, skipped, message }`. A página `ContatosAdvbox.tsx` renderiza um toast custom (sonner `toast.custom`) em formato checklist com 3 estados:
- ✅ verde (`ok: true`)
- ⚠️ amarelo (`skipped: true` — etapa intencionalmente pulada com motivo)
- ❌ vermelho (`ok: false && !skipped` — falha real)

Cabeçalho do toast classifica o resultado global em "sucesso", "avisos" ou "falhas".

## Configuração admin

Tela `Configurações do Comercial` (modal em `/contatos-advbox`):
- Vendedores ativos com input de ID ChatGuru (com aviso amarelo se ativo sem ID).
- Marcos obrigatório (switch).
- Setor Comercial (switch desabilitado quando ID vazio + aviso explicativo).
- ChatGuru ativo (switch global).
- Texto da observação (configurável).
- Prazo padrão da tarefa CRM e método de distribuição.

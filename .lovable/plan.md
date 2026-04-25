# Corrigir automação "Nova Demanda" — ChatGuru + observabilidade

> Estou em modo plano (read-only). Aprovando, entro em modo de execução e aplico tudo de uma vez.

## Diagnóstico já feito

- **CRM e rodízio funcionam** corretamente (~100% de sucesso).
- **ChatGuru falha em ~87% das demandas** (campo `chatguru_note_id` fica `NULL`).
- **Causas:**
  1. Telefone enviado sem normalização BR robusta (DDD/9º dígito) → ChatGuru rejeita.
  2. Edge function não verifica se o chat existe no ChatGuru antes de mandar nota.
  3. `setor_comercial_chatguru_id` está vazio no `comercial_config` (e o usuário confirmou que **não existe** esse usuário no ChatGuru).
  4. Erros são engolidos silenciosamente — nem usuário nem banco veem o problema.

## Mudanças (3 arquivos, sem migração de schema)

### 1) `supabase/functions/create-commercial-demand/index.ts` — reescrita

- **`normalizePhoneBR(raw)`**: remove máscara, valida DDD (11–99), garante prefixo 55, aceita 8 ou 9 dígitos. Retorna `null` se inválido.
- **Verificação de chat antes de qualquer ação**: chama `chat_check`. Se não existir, tenta `chat_add` com nome do cliente.
- **Status estruturado** acumulado durante a execução:
  ```json
  {
    "phone_normalized": "5531988208999",
    "chat_check": { "ok": true, "raw": {...} },
    "chat_create": { "skipped": true },
    "note_add": { "ok": true, "id": "..." },
    "status_open": { "ok": true },
    "assignments": [
      { "role": "vendedor", "ok": true },
      { "role": "marcos", "ok": true }
    ],
    "setor_comercial": { "skipped": true, "reason": "ID não configurado" }
  }
  ```
- **Detecção de sucesso real do ChatGuru** via `result === "OK"` ou `id`/`note_id` na resposta (a heurística atual aceitava qualquer 200, mascarando falhas).
- **Logs em `integration_sync_log`** (tabela já existe) com payload e response brutos para todas as falhas.
- **Resposta enriquecida** ao frontend: além de `success`, devolve `steps_summary` (lista pronta para renderizar checklist) e `chatguru_status` (debug detalhado).
- **Setor Comercial**: como o ID não existe no ChatGuru, esta etapa é registrada como `skipped` com `reason` explícito — sem contar como erro.
- Marcos continua sendo atribuído (ID `63ff69df1c00b36c82814a99` já configurado).

### 2) `src/pages/ContatosAdvbox.tsx` — toast detalhado

Substituir o toast genérico por um checklist baseado em `data.steps_summary`:

```
✅ Demanda registrada
✅ Vendedor atribuído: Maria (rodízio)
✅ Tarefa criada no CRM
✅ Anotação no ChatGuru
✅ Chat marcado como aberto
✅ Vendedor atribuído no ChatGuru
✅ Marcos atribuído no ChatGuru
⚠️ Setor Comercial: ID não existe no ChatGuru (pulado)
```

Cores: verde (ok), amarelo (skipped intencional), vermelho (falha real).
Toast com `duration: 12000` para dar tempo de leitura, ou um pequeno modal pós-envio com a lista. Vou usar **toast com componente custom JSX** dentro do sonner (suporta `toast.custom()`).

### 3) `src/pages/ContatosAdvbox.tsx` — UI Admin

- Marcar **"Setor Comercial"** com nota visível: *"O ChatGuru não possui um usuário 'Setor Comercial' — esta atribuição está desativada."* Switch fica **desabilitado e em off** quando o ID está vazio.
- Aviso visual amarelo no card "ID ChatGuru do Setor Comercial" reforçando que sem ID essa atribuição é ignorada.
- Aviso similar em qualquer vendedor sem `chatguru_user_id` cadastrado.

## NÃO precisa de migração de schema

A proposta anterior de adicionar colunas `chatguru_status` e `chatguru_last_attempt_at` em `comercial_demandas` foi descartada — vou usar a tabela **existente** `integration_sync_log` para persistir o JSON detalhado, e devolver o status na resposta direta da edge function. Mais limpo e sem alterar schema.

## Não muda

- Lógica de rodízio (já funciona).
- Criação de tarefa no CRM (já funciona).
- IDs ChatGuru de Marcos e dos vendedores.
- Permissões / RLS / outras integrações.

## Risco

Baixo. Toda chamada externa em `try/catch` e nunca bloqueia a criação da demanda. Pior caso: ChatGuru fora do ar → demanda + CRM continuam ok, e o usuário vê no toast quais etapas falharam (em vez do silêncio atual).

## Validação após deploy

1. Demanda com cliente que tem WhatsApp ativo → todas etapas ✅ (exceto Setor Comercial = ⚠️ pulado).
2. Demanda com telefone inválido → toast mostra ⚠️ nas etapas ChatGuru, demanda + CRM ✅.
3. Conferir `integration_sync_log` filtrando `target_table = 'chatguru+crm'` — deve ter um registro por demanda com JSON detalhado.
4. Verificar `comercial_demandas.chatguru_note_id` — passa de ~13% para próximo de 100% para clientes com WhatsApp válido.

---

**Aprovando, aplico edge function + UI no mesmo passo, faço deploy e te aviso.**

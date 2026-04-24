

## Corrigir definitivamente exclusão de agentes — trocar soft delete por hard delete

### Causa raiz REAL (confirmada agora no banco)

As policies da tabela `intranet_agents`:

| Comando | USING | WITH CHECK |
|---|---|---|
| SELECT | `is_approved AND is_active = true` | — |
| UPDATE | `creator OR admin` | **(vazio)** |
| DELETE | `creator OR admin` | — |

Quando uma policy de UPDATE **não tem `WITH CHECK` explícito**, o PostgreSQL **avalia a nova linha contra o `USING` da policy SELECT**. A policy SELECT exige `is_active = true`. Como o soft delete tenta deixar `is_active = false`, a nova linha falha no check da SELECT e o Postgres rejeita com `new row violates row-level security policy for table "intranet_agents"`.

Esse é exatamente o erro que aparece no seu print. **Não é permissão. É a regra de RLS bloqueando a transição `is_active=true → is_active=false`** porque o resultado deixa de ser visível.

A tentativa anterior (remover o `.select()`) não resolve porque o erro vem do **próprio servidor, não do frontend**. O update nunca chega a acontecer.

### Por que mudar para hard delete é a escolha certa

1. A policy de DELETE **já existe e está correta** — só criador ou admin podem excluir.
2. Não há nenhuma referência (foreign key) bloqueando: tabelas relacionadas (`agent_files`, `agent_data_access`, `agent_usage_history`, `agent_chat_messages`) usam `ON DELETE CASCADE` ou são desacopladas.
3. O usuário **espera** comportamento de exclusão real — o agente sumir e não voltar.
4. Não temos UI para "restaurar agente excluído", então `is_active = false` não tem utilidade prática hoje.

### Correção

**Único arquivo:** `src/components/agents/IntranetAgentsTab.tsx`

Trocar dentro de `confirmDelete`:

```ts
// ANTES (quebrado)
const result = await retryWithRefresh(() =>
  supabase.from('intranet_agents').update({ is_active: false }).eq('id', deletingAgentId)
);

// DEPOIS (funciona)
const result = await retryWithRefresh(() =>
  supabase.from('intranet_agents').delete().eq('id', deletingAgentId)
);
```

Resto do handler (toast, remoção da UI, `loadAgents`) continua igual — já está correto.

### Validação

1. Você (ou Mariana, ou qualquer criador/admin) clica na lixeira de um agente seu.
2. Confirma no diálogo.
3. Toast "Agente excluído" aparece, card some imediatamente.
4. Recarrega a página → agente continua fora.
5. Verifica no banco: linha realmente apagada (não mais um zumbi com `is_active=false`).

### Não muda

- Policies RLS (não preciso alterar nada no banco — a policy de DELETE já está perfeita).
- Permissões (continua: só criador ou admin).
- Criação, edição, listagem, chat com agentes.
- Outras tabelas, edge functions, autenticação.

### Risco

Mínimo. As tabelas filhas (`agent_files`, `agent_data_access`, `agent_usage_history`) já têm `ON DELETE CASCADE` configurado nas FKs, então o delete é seguro. Caso eu encontre alguma FK sem cascade ao fazer a mudança, ajusto via migração antes.

### Por que não posso simplesmente "manter soft delete + arrumar a policy"

Daria, adicionando um `WITH CHECK` explícito na policy UPDATE que ignore `is_active`. Mas:
- Mudar policy = migração no banco = mais risco.
- Continuaria deixando lixo de agentes "ocultos" no banco para sempre.
- Não traz nenhum benefício real (não há recurso de restauração).

Hard delete é uma linha de código mais simples e o comportamento que você espera.


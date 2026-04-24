## Corrigir exclusão de agentes da intranet

### Causa raiz (confirmada)

O problema está no fluxo de exclusão em `src/components/agents/IntranetAgentsTab.tsx`.

Hoje o botão de excluir faz um **soft delete**:

```ts
supabase
  .from('intranet_agents')
  .update({ is_active: false })
  .eq('id', deletingAgentId)
  .select()
```

Só que a policy de leitura da tabela `intranet_agents` permite ver apenas agentes com `is_active = true`:

```sql
USING (is_approved(auth.uid()) AND is_active = true)
```

Então acontece este conflito:

1. o update tenta marcar o agente como `is_active = false`
2. imediatamente depois, o `.select()` tenta retornar a linha atualizada
3. essa linha já não passa mais na policy de SELECT, porque deixou de ser `is_active = true`
4. o frontend interpreta a ausência da linha retornada como erro/permissão negada

Ou seja: o erro não é porque você não é o criador. O erro acontece porque o código de exclusão depende de ler de volta uma linha que, por regra, fica invisível logo após o soft delete.

### O que será ajustado

1. **Remover a dependência do `.select()` no delete** em `src/components/agents/IntranetAgentsTab.tsx`.
2. Tratar a exclusão como sucesso quando o `update` não retornar erro.
3. Após sucesso, atualizar a UI corretamente:
   - remover o card da lista localmente, ou
   - recarregar `loadAgents()`.
4. Manter o `retryWithRefresh()` como está, para continuar cobrindo sessão expirada.

### Ajuste técnico exato

No `confirmDelete`, trocar a lógica atual por uma abordagem deste tipo:

```ts
const { error } = await retryWithRefresh(() =>
  supabase
    .from('intranet_agents')
    .update({ is_active: false })
    .eq('id', deletingAgentId)
);

if (error) {
  toast.error(...)
} else {
  toast.success('Agente excluído');
  loadAgents();
}
```

Também vou remover a checagem:

```ts
!result.data || result.data.length === 0
```

porque, neste caso, ela gera um falso negativo por causa da policy de SELECT.

### Por que isso explica exatamente o seu caso

- O ícone de lixeira só aparece para **criador ou admin**.
- A policy de `UPDATE` já está correta:

```sql
is_approved(auth.uid())
AND (auth.uid() = created_by OR has_role(auth.uid(), 'admin'))
```

- Então o bloqueio não está na regra de “quem pode excluir”.
- O bloqueio está na etapa seguinte: o frontend exige um retorno visível da linha, mas o próprio soft delete faz a linha deixar de ser visível.

### Arquivo que será alterado

- `src/components/agents/IntranetAgentsTab.tsx`

### Não muda

- Tabela `intranet_agents`
- Policies/RLS atuais
- Criação e edição de agentes
- Permissões de criador/admin
- Edge functions e banco

### Validação após a correção

1. Criar um agente com usuário comum aprovado.
2. Excluir esse mesmo agente.
3. Confirmar que:
   - aparece toast de sucesso
   - o card some da tela
   - ao recarregar a página o agente continua excluído
4. Validar também exclusão por admin.

### Risco

Baixíssimo. É uma correção local de frontend, em um único handler, sem mudar lógica de negócio nem regras de segurança.
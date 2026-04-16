

## Corrigir erro ao excluir agente de IA

### Diagnóstico

Verifiquei o banco e a UI:

1. **Política RLS está correta** — permite UPDATE para criador OU admin. Rafael tem role `admin`, então pode excluir qualquer agente.
2. **Trigger normal** (apenas `updated_at`).
3. **Soft delete funciona** (marca `is_active = false`).
4. **Logs de autenticação mostram diversos `403 invalid claim: missing sub claim`** — sessão JWT expirada/corrompida em algumas requisições.

### Causa raiz provável

O código atual em `IntranetAgentsTab.tsx` (`confirmDelete`) **engole o erro real** e mostra apenas "Erro ao excluir agente":

```ts
if (error) { toast.error('Erro ao excluir agente'); }
```

Sem o detalhe do erro, ficamos cegos. As duas causas mais prováveis são:
- **JWT expirado** (visível nos logs) → `update` retorna erro de auth e a UI não tenta refresh
- **Usuário não-admin tentando excluir agente de outra pessoa** → RLS bloqueia silenciosamente (UPDATE não afeta nenhuma linha, mas o Supabase pode não retornar erro — apenas 0 linhas; nesse caso a UI mostra "sucesso" enganoso)

### Correção

**Arquivo: `src/components/agents/IntranetAgentsTab.tsx`**

1. **Usar `useSessionRefresh`** (já existe no projeto) com `retryWithRefresh` para re-tentar automaticamente em caso de JWT expirado.
2. **Logar o erro real** no console e exibir mensagem detalhada no toast.
3. **Verificar quantas linhas foram afetadas** — usar `.select()` após o `.update()` e, se vazio, mostrar erro de permissão claro ("Você não tem permissão para excluir este agente").
4. **Esconder o botão de excluir** corretamente quando o usuário não é o criador nem admin (usar `useUserRole` para checar role admin no front e exibir o botão também para admins).

### Pseudocódigo da correção

```ts
const { isAdmin } = useUserRole();
const { retryWithRefresh } = useSessionRefresh();

const confirmDelete = async () => {
  if (!deletingAgentId) return;
  const result = await retryWithRefresh(() =>
    supabase
      .from('intranet_agents')
      .update({ is_active: false })
      .eq('id', deletingAgentId)
      .select()  // retorna linhas afetadas
  );
  if (result.error) {
    console.error('Delete error:', result.error);
    toast.error(`Erro ao excluir: ${result.error.message}`);
  } else if (!result.data || result.data.length === 0) {
    toast.error('Você não tem permissão para excluir este agente');
  } else {
    toast.success('Agente excluído');
    loadAgents();
  }
  setDeletingAgentId(null);
};

// Botão de excluir visível para criador OU admin
{(user?.id === agent.created_by || isAdmin) && (
  <Button ... onClick={() => setDeletingAgentId(agent.id)}>
    <Trash2 />
  </Button>
)}
```

### Resultado
- O erro real ficará visível (mensagem detalhada no toast e console).
- JWT expirado será refreshed automaticamente antes de falhar.
- Admins (Rafael) poderão excluir agentes criados por qualquer pessoa via UI.
- Usuários sem permissão receberão mensagem clara em vez de erro genérico.

### Arquivo modificado
- `src/components/agents/IntranetAgentsTab.tsx`

Sem migração de banco — as policies já estão corretas.


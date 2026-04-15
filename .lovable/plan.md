

## Corrigir erro ao cadastrar novo lead no CRM

### Causa raiz
A tabela `crm_contacts` não possui uma política de INSERT para usuários com permissão `edit`. Apenas sócios (via política ALL) conseguem inserir contatos. Usuários do comercial com permissão `lead_tracking = edit` têm políticas de SELECT e UPDATE, mas **não de INSERT**, o que bloqueia a criação de novos leads.

Para comparação, a tabela `crm_deals` já possui a política de INSERT correta.

### Correção

**Migração SQL** — adicionar política de INSERT na tabela `crm_contacts`:

```sql
CREATE POLICY "Usuários com permissão edit podem inserir contatos"
ON public.crm_contacts
FOR INSERT
TO authenticated
WITH CHECK (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');
```

Também adicionar política de DELETE (para consistência com `crm_deals`):

```sql
CREATE POLICY "Usuários com permissão edit podem deletar contatos"
ON public.crm_contacts
FOR DELETE
TO authenticated
USING (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');
```

### Resultado
Usuários do comercial com permissão `lead_tracking = edit` poderão criar e excluir contatos/leads no CRM sem erro.

Nenhuma alteração de código necessária — o frontend já está correto, o problema é exclusivamente nas políticas de acesso do banco.


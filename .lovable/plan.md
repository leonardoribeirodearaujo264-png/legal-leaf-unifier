

## Corrigir erro ao criar pagamento de parceiros

### Investigação
Analisei a tabela `parceiros_pagamentos`, suas políticas RLS, constraints, tipos e o código do dialog. A tabela está **completamente vazia** — nenhum pagamento foi criado com sucesso até hoje. As políticas RLS e constraints parecem corretas, mas o toast genérico "Erro ao criar pagamento" esconde o erro real do banco.

### Problemas identificados

1. **Erro genérico esconde a causa real**: O `catch` mostra apenas "Erro ao criar pagamento" sem o detalhe do banco. Precisa mostrar `error.message` para diagnosticar.

2. **`SelectItem value=""` inválido no Radix UI**: O componente Select tem `<SelectItem value="">Nenhuma</SelectItem>`. Radix UI não suporta string vazia como value, o que pode corromper o estado do formulário e enviar dados inválidos para o `indicacao_id`.

3. **Falta política de UPDATE/DELETE para não-admins**: Apenas admins têm ALL. Se um colaborador precisar alterar status de pagamento no futuro, será bloqueado.

### Correções

**1. PagamentoParceiroDialog.tsx — Mostrar erro real + corrigir SelectItem**
- No `catch`, usar `toast.error(\`Erro ao criar pagamento: \${error.message}\`)` para mostrar o erro real do banco
- Trocar `<SelectItem value="">Nenhuma</SelectItem>` por `<SelectItem value="none">Nenhuma</SelectItem>`
- No insert, converter `indicacao_id`: `formData.indicacao_id && formData.indicacao_id !== 'none' ? formData.indicacao_id : null`
- Adicionar validação antes do insert para garantir dados limpos

**2. Migração SQL — Adicionar política UPDATE para aprovados**
```sql
CREATE POLICY "Usuarios aprovados podem atualizar pagamentos"
ON public.parceiros_pagamentos FOR UPDATE TO authenticated
USING (is_approved(auth.uid()))
WITH CHECK (is_approved(auth.uid()));
```

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/components/parceiros/PagamentoParceiroDialog.tsx` | Mostrar erro real no toast, corrigir `SelectItem value`, validar dados |
| Migração SQL | Adicionar política UPDATE para aprovados |

### Resultado
- O toast mostrará o erro exato do banco, facilitando diagnóstico
- O SelectItem "Nenhuma" funcionará corretamente com Radix UI
- Se o erro persistir após essas correções, a mensagem detalhada revelará a causa exata


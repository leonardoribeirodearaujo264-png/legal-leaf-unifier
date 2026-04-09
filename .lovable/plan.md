

## Expandir dados dos Contatos ADVBox e adicionar edição

### Problema

1. A sincronização do ADVBox salva poucos campos (name, cpf, cnpj, tax_id, email, phone, birthday). A API retorna muitos outros dados (endereço, profissão, RG, estado civil, etc.) que são descartados.
2. Quase todos os registros têm CPF/CNPJ/birthday nulos porque a API retorna esses dados em campos com nomes diferentes dos mapeados.
3. O usuário quer editar dados do cliente pela intranet e sincronizar de volta ao ADVBox.

### Investigação da API

A API do ADVBox já suporta `PUT /customers/{id}` (confirmado pelo padrão existente de `PUT /posts/{task_id}` na mesma integração). A função `makeAdvboxRequest` já aceita métodos PUT com body.

### Alterações

**1. Migration — Adicionar colunas extras à tabela `advbox_customers`**

Novas colunas para capturar todos os dados do ADVBox:
- `rg`, `orgao_emissor`, `nacionalidade`, `naturalidade`, `estado_civil`, `profissao`, `sexo`
- `endereco`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep`
- `telefone_fixo`, `celular`, `telefone_comercial`
- `nome_mae`, `nome_pai`
- `observacoes`
- `raw_data` (JSONB) — armazena o JSON completo da API para nunca perder nenhum campo

**2. Atualizar `supabase/functions/sync-advbox-customers/index.ts`**

Expandir o mapeamento do batch para incluir todos os campos novos + salvar o JSON completo em `raw_data`. Tentar múltiplas variações de nomes de campo da API (ex: `customer.address`, `customer.street`, `customer.endereco`).

**3. Atualizar `src/pages/ContatosAdvbox.tsx`**

- **Card na lista**: mostrar nome + telefone (já faz isso)
- **Dialog de detalhes**: expandir para mostrar TODOS os campos disponíveis, organizados em seções (Dados Pessoais, Documentos, Endereço, Contato, Outros). Para campos que vieram nulos na tabela, verificar `raw_data` como fallback.
- **Modo edição**: adicionar botão "Editar" no dialog que transforma os campos em inputs editáveis. Ao salvar:
  1. Atualiza localmente no banco `advbox_customers`
  2. Faz PUT via edge function para sincronizar de volta ao ADVBox

**4. Criar ação `update-customer` no `advbox-integration/index.ts`**

Novo case no switch para `update-customer`:
```ts
case 'update-customer': {
  const { customer_id, ...updateData } = body;
  const result = await makeAdvboxRequest({
    endpoint: `/customers/${customer_id}`,
    method: 'PUT',
    body: updateData,
  });
  // Atualizar também no banco local
}
```

**5. Re-deploy da função `sync-advbox-customers`**

Para que a próxima sincronização automática já capture todos os campos expandidos.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar ~15 colunas + `raw_data` JSONB |
| `supabase/functions/sync-advbox-customers/index.ts` | Expandir mapeamento de campos |
| `supabase/functions/advbox-integration/index.ts` | Novo case `update-customer` |
| `src/pages/ContatosAdvbox.tsx` | Dialog expandido + modo edição |


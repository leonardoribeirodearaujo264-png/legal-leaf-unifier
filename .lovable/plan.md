

## Mapear IDs do ChatGuru e atualizar a Edge Function

### Contexto

O usuário forneceu os IDs do ChatGuru de cada pessoa envolvida:

| Pessoa | Papel | ChatGuru ID |
|--------|-------|-------------|
| Daniel Martins Silva | Vendedor (rodízio) | `66392c1575f9357baf26ad8a` |
| Lucas Mendes de Paula | Vendedor (rodízio) | `652c57bb2619cad2db392625` |
| Marcos Luiz Egg Nunes | Head Comercial (sempre marcado) | `63ff69df1c00b36c82814a99` |
| Setor Comercial | Departamento (sempre marcado) | Sem ID encontrado |

Jhonny Silva Souza já está na tabela de vendedores mas não teve ID do ChatGuru informado. Permanece no rodízio, mas sem marcação no ChatGuru até que o ID seja fornecido.

### Alterações

**1. Migration — Adicionar `chatguru_user_id` à tabela `comercial_vendedores_config`**

- Adicionar coluna `chatguru_user_id TEXT` para mapear cada vendedor ao seu ID no ChatGuru
- Preencher os IDs conhecidos (Daniel e Lucas)
- Criar uma tabela simples `comercial_config` (chave-valor) para armazenar o ID do Marcos e do setor comercial como configurações fixas

```sql
ALTER TABLE comercial_vendedores_config ADD COLUMN chatguru_user_id TEXT;
UPDATE comercial_vendedores_config SET chatguru_user_id = '66392c1575f9357baf26ad8a' WHERE vendedor_nome ILIKE '%Daniel%';
UPDATE comercial_vendedores_config SET chatguru_user_id = '652c57bb2619cad2db392625' WHERE vendedor_nome ILIKE '%Lucas%';

-- Config fixa para Marcos (Head) e setor comercial
CREATE TABLE comercial_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO comercial_config VALUES 
  ('marcos_chatguru_id', '63ff69df1c00b36c82814a99'),
  ('setor_comercial_chatguru_id', '');
```

**2. Atualizar `create-commercial-demand/index.ts`**

A chamada `chat_edit` atual só muda o status para "O" (aberto) mas **não passa nenhum `user_id`**. Preciso:

- Buscar o `chatguru_user_id` do vendedor sorteado da tabela `comercial_vendedores_config`
- Buscar o ID do Marcos da tabela `comercial_config`
- Fazer chamadas `chat_edit` passando `user_id` para cada pessoa (vendedor sorteado + Marcos)
- Se o setor comercial tiver ID configurado, incluí-lo também
- A API do ChatGuru (`chat_edit`) aceita o parâmetro `user_id` para marcar responsáveis. Se precisar marcar múltiplos, fazer chamadas sequenciais ou usar o parâmetro de array conforme a API permitir

**3. Atualizar UI de configuração de vendedores em `ContatosAdvbox.tsx`**

- Adicionar campo "ID ChatGuru" na interface de configuração de vendedores para que novos vendedores possam ter seu ID mapeado
- Exibir os IDs já configurados

### Sobre o "Setor Comercial"

Como não foi encontrado um ID no ChatGuru para o setor comercial, vou deixar o campo configurável na tabela `comercial_config`. Quando o ID for descoberto, basta atualizá-lo. Enquanto estiver vazio, o sistema marcará apenas o vendedor sorteado + Marcos.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar `chatguru_user_id` + criar `comercial_config` |
| `supabase/functions/create-commercial-demand/index.ts` | Passar `user_id` nas chamadas `chat_edit` |
| `src/pages/ContatosAdvbox.tsx` | Campo de ID ChatGuru na config de vendedores |


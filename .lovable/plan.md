

## Remover Jhonny e investigar ID do Setor Comercial no ChatGuru

### Descoberta sobre o ChatGuru

A API do ChatGuru v1 (`chat_edit`) trabalha exclusivamente com `user_id` para atribuir responsáveis. Não existe um parâmetro `department_id` ou equivalente. O "Setor Comercial" no ChatGuru é provavelmente um **usuário do tipo departamento/setor** — funciona como um usuário normal com seu próprio `user_id`. Para encontrá-lo, basta acessar a tela de usuários/setores no painel do ChatGuru (mesma tela onde foram encontrados os IDs do Daniel, Lucas e Marcos) e localizar o "Setor Comercial" ali. Uma vez encontrado o ID, basta inserir na tabela `comercial_config` com a chave `setor_comercial_chatguru_id`.

**Enquanto o ID não for preenchido, o sistema já funciona corretamente** — apenas ignora a atribuição do setor, marcando o vendedor sorteado + Marcos.

### Alterações

**1. Migration — Remover Jhonny da tabela de vendedores**

```sql
DELETE FROM comercial_vendedores_config WHERE vendedor_nome ILIKE '%Jhonny%';
```

Isso remove Jhonny do rodízio imediatamente. Restam Daniel e Lucas.

**2. Nenhuma alteração no código**

A edge function e a UI já estão funcionais. O campo `setor_comercial_chatguru_id` na tabela `comercial_config` já existe e está vazio — basta preencher quando o ID for localizado.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Remover Jhonny da `comercial_vendedores_config` |


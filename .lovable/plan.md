

## Corrigir exibição de dados dos Contatos ADVBox

### Problemas identificados

1. **Dados não sincronizados**: Todos os 10.426 registros têm `raw_data = null` e os campos expandidos (CPF, RG, endereço, profissão, etc.) vazios. A sincronização não executou desde que as colunas foram adicionadas. Os dados existem no ADVBox mas não foram puxados para os campos novos.

2. **Card na lista não mostra telefone/CPF**: O card já tem código para mostrar telefone, email e CPF, mas como muitos registros têm CPF nulo (não sincronizado), parece que faltam dados. O card precisa continuar mostrando esses campos.

3. **Dialog de detalhes não mostra dados sem editar**: A função `renderSection` esconde seções inteiras quando nenhum campo tem valor (`if (!editing && !hasData) return null`). Como os campos estão vazios (sync não rodou), o dialog aparece praticamente vazio. Quando clica "Editar", os campos aparecem porque o código mostra inputs vazios no modo edição. O comportamento correto é: ao clicar no card, mostrar TODOS os dados preenchidos; o botão "Editar" serve apenas para modificar.

### Plano de correção

**1. Forçar re-sincronização dos clientes**

Chamar a edge function `sync-advbox-customers` para rodar novamente, agora com o mapeamento expandido que já está no código. Isso preencherá `raw_data` e todos os campos extras (CPF, endereço, profissão, etc.) para todos os 10.426 registros.

**2. Corrigir o Dialog de detalhes em `src/pages/ContatosAdvbox.tsx`**

- No modo visualização (não edição), mostrar TODAS as seções sempre, exibindo os campos que têm valor
- A lógica `renderSection` continuará escondendo campos individuais sem valor, mas as seções com pelo menos 1 campo preenchido devem aparecer
- Garantir que o fallback para `raw_data` funcione: se o campo direto está nulo, buscar no JSON `raw_data`
- Isso já está implementado na função `getVal`, mas precisa funcionar depois que `raw_data` for preenchido pela sincronização

**3. Manter card na lista com nome + telefone + CPF**

O card já mostra nome, telefone, email e CPF/CNPJ. Após a sincronização preencher esses campos, os dados aparecerão automaticamente. Nenhuma alteração de código necessária no card.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/pages/ContatosAdvbox.tsx` | Nenhuma alteração necessária — a lógica de exibição já está correta, o problema é que os dados estão vazios no banco |

### Ação principal

Disparar a edge function `sync-advbox-customers` para re-sincronizar todos os clientes com o mapeamento expandido. Isso preencherá `raw_data` e os campos extras. Após a sincronização (que pode levar várias execuções por causa do limite de tempo), os dados aparecerão corretamente no dialog e nos cards.




## Três correções no CRM

### 1. Tela inteira no CRM (sem sidebar)

**Problema**: O menu lateral da intranet ocupa espaço, deixando o CRM apertado, especialmente o Kanban.

**Solução**: Modificar `src/pages/CRM.tsx` para não usar o `<Layout>` padrão quando o CRM estiver ativo. Em vez disso, renderizar o CRM em tela inteira com um botão "Voltar" no topo que navega para o Dashboard (ou página anterior).

**Arquivo: `src/pages/CRM.tsx`**
- Remover o wrapper `<Layout>` do conteúdo principal do CRM
- Renderizar uma barra superior simples com botão "Voltar", título "CRM" e tema toggle
- O conteúdo do CRM ocupará 100% da largura da tela

### 2. Estrelas de classificação nos deals (1-5)

**Problema**: O usuário quer classificar clientes/oportunidades com estrelas (1-5) para priorizar quem está mais propenso a fechar.

**Solução**:
- **Migração**: Adicionar coluna `star_rating` (integer, default 0) à tabela `crm_deals`
- **`src/components/crm/CRMDealsKanban.tsx`**:
  - Adicionar componente de estrelas clicáveis no dialog de detalhes do deal (aba "Oportunidade")
  - Ao clicar uma estrela, salvar no banco imediatamente via `supabase.update`
  - Exibir estrelas também no card do Kanban (abaixo do nome), de forma compacta
  - Permitir filtrar/ordenar por estrelas

### 3. Corrigir drag-and-drop no Pipeline

**Problema**: Ao arrastar um card e soltar em outra etapa, ele não fixa. O `closestCenter` pode resolver para um deal card (que é draggable) em vez da coluna droppable. Quando `over.id` é um deal ID, o check `stages.some(s => s.id === newStageId)` falha silenciosamente.

**Solução no `handleDragEnd`** (`src/components/crm/CRMDealsKanban.tsx`):
- Quando `over.id` não corresponde a nenhum stage, verificar se `over.id` é um deal. Se for, encontrar o `stage_id` desse deal e usar como destino.
- Isso garante que soltar sobre um card dentro de uma coluna funcione corretamente.

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  setActiveDeal(null);
  if (!over) return;

  const dealId = active.id as string;
  const deal = deals.find(d => d.id === dealId);
  if (!deal) return;

  let newStageId = over.id as string;
  
  // If dropped on a deal card, find which stage that deal belongs to
  if (!stages.some(s => s.id === newStageId)) {
    const targetDeal = deals.find(d => d.id === newStageId);
    if (targetDeal) {
      newStageId = targetDeal.stage_id;
    } else {
      return; // Unknown target
    }
  }

  if (newStageId !== deal.stage_id) {
    handleMoveToStage(dealId, newStageId, deal.stage_id);
  }
};
```

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/CRM.tsx` | Remover `<Layout>`, renderizar tela inteira com botão voltar |
| `src/components/crm/CRMDealsKanban.tsx` | Corrigir drag-and-drop + adicionar estrelas no card e dialog |
| Migração SQL | `ALTER TABLE crm_deals ADD COLUMN star_rating integer DEFAULT 0` |


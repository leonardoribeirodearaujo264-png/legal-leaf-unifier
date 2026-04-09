
## Corrigir arraste do pipeline CRM

### Diagnóstico do que verifiquei
- O pipeline já usa `dnd-kit`, mas hoje o arraste está preso ao ícone pequeno de “grip” dentro do card. Se o colaborador tenta arrastar pelo corpo do card, parece que nada funciona.
- O problema não parece ser de acesso padrão do cargo: o perfil `comercial` já está com permissão de edição no CRM/lead tracking.
- A sincronização do CRM está ativa, e não apareceram chamadas recentes de atualização de etapa no backend. Isso indica que a falha principal está acontecendo na interação do front, antes de chegar na atualização do status.
- Além disso, a lógica atual de mover não atualiza o status de forma completa: ela não trata corretamente `stage_changed_at` e também não limpa/ajusta `won` e `closed_at` em todos os cenários.

### O que vou implementar
**1. Ajustar o drag-and-drop no Kanban**
- Arquivo: `src/components/crm/CRMDealsKanban.tsx`
- Fazer o card poder ser arrastado de forma confiável pelo card inteiro (ou por uma área de arraste muito mais ampla), e não só pelo ícone pequeno.
- Manter os botões do card (visualizar / mover) funcionando sem conflito com o arraste.
- Reforçar a área “dropável” da coluna para aceitar drop tanto em espaço vazio quanto sobre outros cards.

**2. Garantir atualização real da etapa e do status**
- Arquivos:
  - `src/components/crm/CRMDealsKanban.tsx`
  - `supabase/functions/crm-sync/index.ts`
- Ao mover:
  - atualizar `stage_id`
  - atualizar `stage_changed_at`
  - marcar `won/closed_at` quando a etapa for ganha/perdida
  - limpar `won/closed_at` quando voltar para uma etapa aberta
- Manter histórico em `crm_deal_history`.

**3. Melhorar a confiabilidade visual**
- Fazer o update otimista refletir imediatamente a nova etapa sem deixar o card “voltar” errado.
- Se houver erro, reverter corretamente e mostrar mensagem clara.
- Tratar com segurança negócios sem `stage_id` para não atrapalharem o pipeline.

**4. Respeitar permissão de edição no próprio Kanban**
- Usar a permissão real do usuário no componente para evitar situação em que a pessoa vê interface de arraste mas não consegue salvar.
- Quem tiver somente visualização não verá uma experiência enganosa de “parece arrastável mas não move”.

### Validação após a implementação
Vou validar estes cenários:
1. Arrastar o card pelo corpo do card entre etapas.
2. Soltar em coluna vazia.
3. Soltar por cima de outro card.
4. Confirmar que a etapa muda visualmente e no banco.
5. Confirmar atualização correta de `won`, `closed_at` e `stage_changed_at`.
6. Confirmar criação do histórico da movimentação.
7. Confirmar que usuário sem permissão de edição não fica com drag falso disponível.

### Arquivos envolvidos
- `src/components/crm/CRMDealsKanban.tsx`
- `supabase/functions/crm-sync/index.ts`

### Banco de dados
- Sem nova tabela e sem migration estrutural. É correção de comportamento e consistência da atualização.

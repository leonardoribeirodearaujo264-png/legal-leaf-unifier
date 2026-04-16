

## Corrigir relatório de tarefas: atrasadas infladas + colaboradores inativos

### Diagnóstico (após análise do código + banco)

A tela da screenshot é o **`WeeklyTaskReport`** (aba "Relatório Semanal" em `/tarefas-advbox`). Encontrei 4 causas reais para o problema:

**1. Colaboradores inativos aparecendo (Tatiane Ferreira Passos):**
- Ela está com `is_active = false` no banco, mas o ADVBox ainda retorna o nome dela em `assigned_users` (string concatenada, ex: `"GUILHERME, MARIANA, TATIANE"`).
- O componente `WeeklyTaskReport` usa essa string crua sem filtrar quem ainda está ativo no escritório.

**2. Tarefas `stale` (descontinuadas) entrando no relatório:**
- Existem 12 tarefas com `status='stale'` no banco. O filtro principal (`/tarefas-advbox`) já oculta `stale`, mas o `WeeklyTaskReport` recebe `tasks` brutas e conta como pendentes/atrasadas.

**3. Tarefas "coletivas" inflando estatísticas:**
- Várias tarefas têm 10–12 responsáveis na mesma string (ex: reuniões, comunicados). Cada nome vira uma "tarefa atrasada" individual no gráfico, multiplicando artificialmente o número de atrasadas por pessoa.

**4. "Atrasada" considerando hora UTC sem normalizar para fuso local:**
- Tarefas com `due_date 2026-04-16 18:00:00+00` (15:00 BRT) que ainda não venceram em horário local podem aparecer como atrasadas dependendo do momento do dia. A regra atual `isBefore(parseISO(due_date), startOfDay(today))` é segura na maioria dos casos, mas tarefas do **próprio dia de hoje** com hora passada vão parar em "pendentes", não em "atrasadas" — confirmado OK. O ruído real vem dos itens 1–3.

### Correção (apenas componente `src/components/WeeklyTaskReport.tsx`)

**A. Buscar lista de colaboradores ativos do banco**
- Adicionar `useEffect` que carrega `profiles` onde `is_active = true AND is_suspended = false AND approval_status = 'approved'`.
- Guardar em `Set<string>` com nomes em UPPERCASE para comparação direta com `assigned_users` do ADVBox (que vem em maiúsculas).

**B. Filtrar tarefas e nomes**
1. **Ignorar tarefas com status `stale`** ou `deleted` no início do `weeklyTasks`.
2. Ao expandir `assigned_to` em nomes individuais, **filtrar nomes que não estão no Set de ativos**.
3. Se a tarefa não tem nenhum responsável ativo após o filtro, **descartar a tarefa** das estatísticas (não conta nem em total, nem em atrasadas).

**C. Contar "atrasadas" só uma vez por tarefa no total geral**
- O `overallStats.overdue` continua contando uma vez por tarefa (correto).
- O `statsByResponsible` continua contando por responsável ativo (correto, pois cada um é responsável de fato).

**D. Sinalizar tarefas coletivas (>5 responsáveis ativos)**
- Adicionar uma badge visual "Compromisso coletivo" na lista de desempenho indicando quando a tarefa tem muitos responsáveis, para o usuário entender por que aparece em vários colaboradores.
- Opcional: adicionar um toggle "Excluir compromissos coletivos (>5 responsáveis)" no cabeçalho do relatório, para limpar o ruído nas comparações individuais.

**E. Aplicar mesma lógica em `RelatoriosProdutividadeTarefas.tsx`**
- O gráfico `tasksByUser` e o ranking `oldestPendingTasks` também devem filtrar nomes inativos e ignorar `stale`.
- Adicionar o mesmo `useEffect` para carregar colaboradores ativos.

### Pseudocódigo

```ts
// 1. Carregar ativos
const [activeNames, setActiveNames] = useState<Set<string>>(new Set());
useEffect(() => {
  supabase.from('profiles')
    .select('full_name')
    .eq('is_active', true).eq('is_suspended', false).eq('approval_status', 'approved')
    .then(({ data }) => setActiveNames(new Set((data||[]).map(p => p.full_name.toUpperCase()))));
}, []);

// 2. Em weeklyTasks: filtrar stale
.filter(t => t.status !== 'stale' && t.status !== 'deleted')

// 3. Em statsByResponsible:
const responsibles = rawResponsible.split(',').map(n => n.trim())
  .filter(name => activeNames.has(name.toUpperCase())); // só ativos

if (responsibles.length === 0) return; // tarefa sem responsável ativo

// 4. Toggle opcional para excluir tarefas com >5 responsáveis
if (excludeCollective && responsibles.length > 5) return;
```

### Resultado esperado
- **Tatiane (e qualquer colaborador inativo) some** automaticamente do relatório semanal e do dashboard de produtividade.
- **Tarefas `stale` deixam de inflar** as contagens.
- Toggle opcional permite ao usuário **isolar tarefas individuais** das coletivas (reuniões em massa).
- Quando um novo colaborador for inativado no futuro, **basta marcar `is_active=false`** e ele desaparece automaticamente — não é necessário corrigir nada no ADVBox.

### Arquivos modificados
- `src/components/WeeklyTaskReport.tsx` — filtro de inativos + stale + toggle coletivo
- `src/pages/RelatoriosProdutividadeTarefas.tsx` — filtro de inativos + stale nos gráficos `tasksByUser`, `oldestPendingTasks` e KPIs

Sem migração de banco. Sem alterações em outras telas.


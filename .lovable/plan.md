

## Ajuste dos filtros do Controle de Prazos

### Problema

Os filtros atuais têm **labels confusos** que não correspondem às colunas da tabela:

- "**Evento início**" / "**Evento fim**" — não existe coluna "Evento" na tabela. Esses filtros, no código, filtram por `prazo_interno`. O label está errado.
- "**Prazo Fatal início**" / "**Prazo Fatal fim**" — o nome sugere duas datas distintas ("início" e "fim" do prazo), mas na verdade é **um intervalo de busca** (de qual data até qual data) sobre a única coluna `Prazo Fatal`. Confunde porque parece haver dois prazos fatais.
- Faltam filtros úteis: **Cliente** e **Nº Processo**.

### Correção proposta

**1. Renomear os filtros existentes** (sem mudar a lógica — apenas o texto):

| Hoje (confuso) | Vai virar (claro) |
|---|---|
| "Publicação início" / "Publicação fim" | "Publicação — de" / "Publicação — até" |
| "Prazo Fatal início" / "Prazo Fatal fim" | "Prazo Fatal — de" / "Prazo Fatal — até" |
| "Evento início" / "Evento fim" | "Prazo Interno — de" / "Prazo Interno — até" |

Isso deixa explícito que cada par é **um intervalo (de/até)** sobre uma das três datas que **realmente existem** na tabela: Data Publicação, Prazo Interno, Prazo Fatal.

**2. Adicionar dois novos filtros que faltavam:**

- **Cliente** — campo de texto livre (busca parcial, case-insensitive) sobre `task.cliente_nome`.
- **Nº Processo** — campo de texto livre (busca parcial) sobre `task.process_number`.

Esses dois entram como `Input` simples (não Select), porque a quantidade de clientes/processos é grande demais para dropdown.

**3. Reorganizar o layout do bloco Filtros** para acomodar os novos campos de forma legível:

```text
Linha 1:  [Advogado ▾] [Tipo de Tarefa ▾] [Status ▾] [Cliente (texto)] [Nº Processo (texto)]
Linha 2:  [Publicação de] [Publicação até] [Prazo Interno de] [Prazo Interno até]
Linha 3:  [Prazo Fatal de] [Prazo Fatal até]                                     [Limpar filtros]
```

Grid responsivo: `grid-cols-1 md:grid-cols-3 lg:grid-cols-5` para a linha de selects, e `md:grid-cols-4` para as linhas de datas.

**4. Lógica dos novos filtros (Cliente / Nº Processo)**

Adicionar dentro do `useMemo` `filteredTasks` (logo após o filtro de status):

```ts
if (filterCliente.trim()) {
  const q = filterCliente.toLowerCase().trim();
  if (!(task.cliente_nome || '').toLowerCase().includes(q)) return false;
}
if (filterProcesso.trim()) {
  const q = filterProcesso.replace(/\D/g, ''); // ignora pontuação
  const proc = (task.process_number || '').replace(/\D/g, '');
  if (!proc.includes(q)) return false;
}
```

E incluir os dois novos states no `useEffect` que reseta a paginação e no botão "Limpar filtros".

### Detalhes técnicos

**Arquivo modificado:**
- `src/pages/ControlePrazos.tsx` — apenas:
  - Adicionar 2 novos `useState`: `filterCliente`, `filterProcesso` (string vazia inicial).
  - Adicionar 2 condições no `filteredTasks` `useMemo`.
  - Adicionar 2 `<Input>` no JSX do bloco de filtros.
  - Renomear os 6 placeholders dos botões de data.
  - Reorganizar o `grid` do bloco de filtros para 3 linhas lógicas.
  - Incluir os 2 novos states na lista de dependências do `useEffect` de reset de página, no `useMemo` `filteredTasks`, na condição que mostra "Limpar filtros" e na função do botão "Limpar filtros".

**Não muda:**
- Nenhuma lógica de negócio (vencido, verificação, sync ADVBox, exportação Excel/PDF).
- Banco de dados, RLS, edge functions — nada é tocado.
- Colunas da tabela — continuam as mesmas (Cliente, Nº Processo, Tarefa, Advogado, Data Publicação, Prazo Interno, Prazo Fatal, Status).

**Risco:** zero. São mudanças de UI puramente locais e aditivas — os filtros existentes continuam funcionando exatamente igual, só com label mais claro.


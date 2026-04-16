

## Corrigir filtro de Responsável em Tarefas Advbox

### Diagnóstico
Em `src/pages/TarefasAdvbox.tsx`, o campo `task.assigned_to` vem do ADVBox como string única com nomes concatenados por vírgula (ex: `"DANIEL MARTINS SILVA, JHONNY SILVA SOUZA, MARCOS LUIZ EGG NUNES"`).

O código atual trata essa string inteira como se fosse "um único responsável":
- **Linha 114-122**: adiciona a string completa ao `Set`, gerando opções com múltiplos nomes no dropdown
- **Linha 139**: filtra por igualdade exata, então selecionar "Daniel" não retorna tarefas onde Daniel está junto com outras pessoas

### Correção (apenas `src/pages/TarefasAdvbox.tsx`)

1. **`assignedUsers` (linha 114-122)**: dividir `task.assigned_to` por vírgula, dar `trim()` em cada nome e adicionar individualmente ao `Set`. Resultado: dropdown mostra apenas nomes únicos individuais (Daniel, Jhonny, Lucas, Marcos, etc.).

2. **Filtro `assignedFilter` (linha 139)**: trocar a comparação de igualdade por uma verificação de inclusão — uma tarefa é compatível se a lista de nomes (separada por vírgula) contém o nome selecionado.

```ts
// Lista de opções
visibleTasks.forEach((task) => {
  if (task.assigned_to) {
    task.assigned_to.split(',').map(n => n.trim()).filter(Boolean)
      .forEach(name => users.add(name));
  }
});

// Filtro
if (assignedFilter !== 'all') {
  const names = (task.assigned_to || '').split(',').map(n => n.trim());
  if (!names.includes(assignedFilter)) return false;
}
```

### Resultado
- Dropdown de Responsável passa a listar apenas **nomes individuais** (sem combinações)
- Selecionar um responsável retorna **todas** as tarefas dele, inclusive as compartilhadas com outras pessoas
- Sem mudanças de banco, sem impacto em outras telas




## Corrigir menu lateral: expandido por padrão, grupos recolhidos

### Problema
1. Menu inicia recolhido (só ícones), com ícones desalinhados/repetidos
2. Os grupos de menu (Produção Jurídica, Ferramentas, etc.) iniciam abertos, mostrando todos os itens de uma vez

### Solução

**`src/components/Layout.tsx`** (linha 166):
- Trocar `defaultOpen={false}` para `defaultOpen={true}` — o menu mostra texto por padrão
- Remover o botão flutuante e lógica associada (já não será necessário com menu expandido por padrão)

**`src/components/AppSidebar.tsx`** (linhas 132-137):
- Mudar a inicialização de `openGroups` para começar vazio (nenhum grupo expandido por padrão)
- Remover a lógica que auto-abre o grupo da rota ativa (useEffect linhas 139-148)
- O grupo só abrirá quando o usuário clicar nele manualmente
- Manter a persistência no localStorage para que, após clicar, o estado seja lembrado

### Resultado
- Menu lateral aparece expandido (com texto) por padrão
- Todos os grupos começam fechados, mostrando apenas os títulos (ex: "⚖️ Produção Jurídica")
- Ao clicar num grupo, ele expande mostrando os itens
- O estado dos grupos abertos/fechados é salvo no localStorage


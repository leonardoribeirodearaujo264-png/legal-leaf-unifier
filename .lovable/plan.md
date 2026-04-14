

## Corrigir scroll do menu recolhido e botão flutuante

### Problema 1: Menu recolhido não permite scroll
O componente `SidebarContent` em `src/components/ui/sidebar.tsx` (linha 334) tem a classe `group-data-[collapsible=icon]:overflow-hidden`, que desabilita o scroll quando o sidebar está no modo ícone (recolhido). Isso impede o usuário de rolar pelos itens do menu.

**Solução:** Trocar `group-data-[collapsible=icon]:overflow-hidden` por `group-data-[collapsible=icon]:overflow-y-auto` para permitir scroll vertical mesmo quando recolhido.

### Problema 2: Botão flutuante de expandir não funciona bem
O botão flutuante atual depende do scroll do conteúdo principal (`mainRef`), mas quando o sidebar está recolhido e o usuário não consegue rolar os itens do menu, o botão fica inacessível. Além disso, o botão flutuante pode conflitar com o scroll do próprio sidebar.

**Solução:** Simplificar — remover a condição de `scrolledDown` do botão flutuante. Quando o sidebar estiver recolhido, o botão flutuante de expandir sempre ficará visível (fixo no canto esquerdo), garantindo que o usuário sempre possa expandir o menu independentemente da posição de scroll.

### Alterações

**`src/components/ui/sidebar.tsx`** (linha 334):
- Trocar `group-data-[collapsible=icon]:overflow-hidden` por `group-data-[collapsible=icon]:overflow-y-auto`

**`src/components/Layout.tsx`**:
- Remover o estado `scrolledDown` e o listener de scroll associado
- Mudar a condição do botão flutuante de `sidebarState === 'collapsed' && scrolledDown` para apenas `sidebarState === 'collapsed'`
- Remover `mainRef` e o `useEffect` de scroll (linhas 194-203) já que não serão mais necessários


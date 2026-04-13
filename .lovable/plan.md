

## Botão flutuante para expandir o menu lateral

### Problema
Quando o menu lateral está recolhido e o usuário rola a página para baixo, o botão de expandir o menu fica preso no cabeçalho (topo). Para expandir, é necessário voltar ao topo da página.

### Solução
Adicionar um botão flutuante (fixed) no canto esquerdo da tela que aparece somente quando:
1. O sidebar está recolhido (collapsed)
2. O usuário rolou para baixo (mais de 100px)

O botão ficará fixo na tela, acompanhando o scroll, permitindo expandir o menu de qualquer posição da página.

### Alteração

**`src/components/Layout.tsx`**:
- Adicionar estado `scrolledDown` que detecta quando o scroll passou de 100px
- Adicionar listener de scroll no container de conteúdo
- Renderizar um `SidebarTrigger` flutuante (position fixed, left, meio da tela vertical) que aparece apenas quando sidebar está collapsed E o usuário rolou para baixo
- Usar `useSidebar()` para verificar o estado do sidebar
- Estilo: botão redondo com ícone de menu, sombra, fundo sólido, z-index alto


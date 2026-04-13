

## Textarea auto-expansível em toda a aplicação

### Problema
Os campos de texto (Textarea) não expandem conforme o usuário digita. Em textos longos, fica limitado a 1-2 linhas visíveis, obrigando o usuário a rolar dentro do campo.

### Solução
Modificar o componente base `Textarea` (`src/components/ui/textarea.tsx`) para incluir auto-resize nativo. Isso afetará automaticamente **todos** os lugares que usam o componente: Mensagens Internas, WhatsApp, Assistente IA, etc.

### Alteração

**`src/components/ui/textarea.tsx`**:
- Adicionar lógica de auto-resize usando `useEffect` + `useCallback`
- A cada mudança de valor, ajustar `textarea.style.height` baseado no `scrollHeight`
- Respeitar o `max-height` já definido via CSS (classes como `max-h-32`, `max-h-[200px]`)
- Combinar refs (interno + externo via `forwardRef`) usando um callback ref
- O textarea começa pequeno (`rows=1` / `min-h`) e cresce até o limite máximo, depois ativa scroll

**Lógica central:**
```typescript
const adjustHeight = () => {
  if (internalRef.current) {
    internalRef.current.style.height = 'auto';
    internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
  }
};
// Chamado no onChange e via useEffect quando value muda
```

Isso é aplicado no componente base, então todas as Textareas do projeto (Mensagens, WhatsApp, Assistente IA, comentários internos, etc.) passarão a expandir automaticamente.


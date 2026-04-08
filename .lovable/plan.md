

## Remover Jhonny da lista de testemunhas de contrato

### Problema
O colaborador Jhonny foi desligado do escritório. Ele ainda aparece como opção de testemunha na assinatura digital de contratos (ZapSign) e vem pré-selecionado por padrão.

### Alteração

**Arquivo: `src/components/ZapSignDialog.tsx`**

1. **Linha 71-75** — Remover Jhonny do array `WITNESSES`:
```ts
const WITNESSES = [
  { key: 'daniel', label: 'Daniel' },
  { key: 'lucas', label: 'Lucas' },
];
```

2. **Linha 101** — Atualizar seleção padrão para Daniel e Lucas:
```ts
const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>(['daniel', 'lucas']);
```

Apenas essas duas linhas precisam ser alteradas. O restante da lógica (validação de 2 testemunhas, toggle, envio para ZapSign) já funciona corretamente com qualquer combinação de 2 testemunhas.


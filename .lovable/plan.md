
## Revisão do problema da procuração

Analisei a transcrição nova e o código atual. Ainda não está 100% corrigido. Há dois pontos que explicam exatamente o que seu colaborador relatou:

### O que ainda está errado

1. **Texto do IPSM ainda pode sair errado**
   - O preset atual só reconhece com segurança `devolução ipsm`.
   - No projeto existem nomes de produto legados como `IPSM`, `alíquota`, `Retroativo - Alíquota e PSM`.
   - Se o fluxo vier com um desses nomes, o sistema pode cair no texto antigo/IA e não usar o modelo curto correto.

2. **A edição da pré-visualização ainda não está valendo no PDF**
   - Hoje o `gerarPDF()` lê o `previewText`, mas faz `setLocalQualification` e `setPoderesEspeciais` imediatamente antes de montar o PDF.
   - Como atualização de estado em React não é síncrona, o PDF ainda pode ser gerado com os valores anteriores.
   - Isso bate exatamente com o relato: a pessoa edita a prévia, mas o PDF final volta para a versão antiga.

## Correções que vou aplicar

### 1) Fortalecer o reconhecimento do produto IPSM
Vou ampliar o helper de presets para reconhecer também variações como:
- `ipsm`
- `alíquota`
- `aliquota`
- `retroativo - alíquota e psm`
- `retroativo - aliquota e psm`

E padronizar o texto curto do IPSM para o modelo desejado, removendo qualquer sobra de “contratante” do fluxo automático.

### 2) Fazer o PDF usar a prévia editada como fonte real
Em vez de:
- extrair do `previewText`
- chamar `setState`
- e gerar o PDF com estados possivelmente antigos

vou ajustar para:
- extrair qualificação e poderes especiais do `previewText`
- guardar isso em variáveis locais
- gerar o PDF diretamente com essas variáveis locais

Assim, o PDF final sai exatamente com o que a pessoa editou na pré-visualização.

### 3) Garantir coerência entre preview e PDF
Vou unificar a montagem do bloco final da procuração para que:
- a pré-visualização use a mesma lógica do PDF
- os poderes especiais continuem em linha após `substabelecimento;`
- se a pessoa apagar ou reescrever esse trecho na prévia, o PDF respeite a edição

### 4) Ajustar o fluxo do comercial para não depender de nome de produto frágil
No `SetorComercial`, a procuração hoje depende do `selectedProduct`, que pode não refletir bem o contexto quando o usuário abre a procuração fora do fluxo do contrato.
Vou revisar esse repasse para priorizar:
1. produto explícito do fluxo
2. produto detectado do rascunho de contrato
3. objeto do contrato

Isso reduz a chance de o preset correto não ser encontrado.

## Arquivos que precisam de ajuste

- `src/lib/procuracaoPowerPresets.ts`
- `src/components/ProcuracaoGenerator.tsx`
- `src/pages/SetorComercial.tsx`

## Resultado esperado após a correção

- O modelo do **IPSM** passa a sair com o texto curto correto, sem “contratante” indevido.
- A edição feita na **pré-visualização da procuração** passa a ser respeitada no PDF final.
- O texto dos poderes especiais não volta mais para a versão antiga ao exportar.
- O comportamento fica consistente tanto no fluxo do **Comercial** quanto quando houver rascunho prévio do contrato.

## Detalhe técnico
O bug principal não é de layout nem de PDF em si; é de sincronização de estado:
- o componente extrai o texto editado da prévia,
- chama `setState`,
- mas gera o PDF no mesmo ciclo,
- então o PDF usa os valores anteriores.

A correção é gerar o PDF com variáveis derivadas do `previewText` no próprio método, sem depender de atualização de estado antes da renderização do documento.

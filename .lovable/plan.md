
## Ajustes na geração de procurações e contratos

### Diagnóstico rápido
- Em `ProcuracaoGenerator` existem dois fluxos de IA; um deles ainda permite respostas longas.
- A procuração hoje não usa o contexto do produto de forma robusta; ela depende mais do objeto do contrato.
- Em `ProcuracaoGenerator` e `DeclaracaoGenerator`, a pessoa pode editar a prévia, mas o PDF é reconstruído a partir dos campos originais, então a edição da pré-visualização se perde.
- Em `ContractGenerator`, o PDF já usa `contractPreviewText`, mas como você relatou erro no vídeo, vou endurecer essa etapa e revisar o fluxo completo de prévia -> PDF.
- O MP4 enviado não pôde ser extraído com as ferramentas de leitura disponíveis neste modo, então o plano cobre os problemas confirmados no código e uma revisão do fluxo inteiro desses geradores.

### O que vou implementar
1. **Mapeamento fixo de poderes especiais curtos por produto**
   - Criar um helper central para reconhecer produto/objeto do contrato.
   - Aplicar exatamente estes textos:
     - **Férias prêmio** → “Especificamente para requerer em espécie as férias prêmio não gozadas no Estado de Minas Gerais.”
     - **Devolução IPSM** → “Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.”
     - **Terço de férias** → “Especificamente para requerer o pagamento do terço de férias excedente aos 30 dias anuais e que não foram quitados.”
     - **Vale refeição** → “Especificamente para requerer o pagamento retroativo do auxílio/vale alimentação em face do Estado de Minas Gerais.”
   - Para outros produtos, gerar apenas **1 frase curta**, no mesmo estilo simples, sem texto longo.

2. **Unificar a lógica de IA da procuração**
   - Fazer os dois botões de geração (`pelo objeto do contrato` e `Gerar com IA`) passarem pela mesma função.
   - Ordem da lógica:
     1. usar modelo fixo por produto;
     2. usar objeto do contrato / rascunho salvo;
     3. só então usar IA com prompt extremamente curto.
   - Sanitizar a resposta para evitar listas, parágrafos longos e excesso de detalhes.

3. **Levar o contexto certo para a procuração**
   - Em `ProcessosAtivos`, passar também o `productName` para `ProcuracaoGenerator`.
   - Em `ProcuracaoGenerator`, ao buscar o rascunho de contrato, carregar também `product_name` além de `objeto_contrato`.
   - Isso permite aplicar o modelo correto mesmo quando a procuração for aberta a partir do fluxo de contratos já salvos.

4. **Fazer a edição da prévia valer no PDF final**
   - `ProcuracaoGenerator`: gerar o PDF a partir de `previewText` quando a prévia tiver sido editada.
   - `DeclaracaoGenerator`: mesmo ajuste.
   - `ContractGenerator`: revisar para garantir que o PDF sempre respeite o texto final visível na prévia, sem regeneração silenciosa.

5. **Revisão do fluxo completo dos geradores**
   - Conferir ida e volta entre edição e pré-visualização.
   - Garantir que apagar trechos, reescrever texto e exportar mantenha exatamente a versão editada.
   - Validar o fluxo nos pontos relatados por você dentro da geração de contrato e procuração.

### Arquivos previstos
- `src/components/ProcuracaoGenerator.tsx`
- `src/components/DeclaracaoGenerator.tsx`
- `src/components/ContractGenerator.tsx`
- `src/pages/ProcessosAtivos.tsx`
- novo helper compartilhado, por exemplo `src/lib/procuracaoPowerPresets.ts`

### Banco de dados
- Não preciso criar tabela nova para essa correção. Vou usar o contexto já existente e o rascunho de contrato que já guarda `product_name`.

### Validação depois da implementação
- Gerar procuração para cada um dos 4 produtos e confirmar que o texto sai exatamente curto, conforme seu modelo.
- Gerar procuração para um produto fora da lista e confirmar que a IA devolve 1 frase curta.
- Editar a prévia de contrato, procuração e declaração, apagar/alterar texto e confirmar que o PDF sai com a mesma edição.
- Testar os fluxos por `Setor Comercial` e `Processos Ativos`.

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Scale, 
  Loader2, 
  FileText,
  Download,
  Eye,
  Edit
} from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoEggnunes from "@/assets/logo-eggnunes.png";

interface Client {
  id: number;
  nomeCompleto: string;
  cpf: string;
  documentoIdentidade: string;
  dataNascimento: string;
  estadoCivil: string;
  profissao: string;
  telefone: string;
  email: string;
  cep: string;
  cidade: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  estado: string;
}

interface DeclaracaoGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  qualification: string;
}

// Texto fixo da declaração conforme modelo oficial
const TEXTO_DECLARACAO = `venho, respeitosamente, à presença de Vossa Excelência, com fundamento no artigo 98 e seguintes do Código de Processo Civil (Lei nº 13.105/2015) e na Lei nº 1.060/1950, fazer a seguinte declaração:

Declaro, sob as penas da lei, para fins de concessão de justiça gratuita, que não possuo condições financeiras de arcar com as custas processuais e os honorários advocatícios sem prejuízo do meu sustento e de minha família.

Declaro, ainda, que meus rendimentos mensais são suficientes apenas para cobrir as despesas básicas de subsistência, incluindo alimentação, saúde e habitação. Além disso, não possuo bens ou rendas que possam garantir o pagamento das custas processuais.

Sendo assim, solicito a concessão dos benefícios da justiça gratuita, com base no direito previsto no artigo 98 do Código de Processo Civil, que estabelece que a parte pode ser beneficiária da gratuidade da justiça quando comprovar insuficiência de recursos para suportar as despesas do processo.

Comprometo-me a informar imediatamente ao juízo qualquer alteração em minha situação financeira que possa influir na concessão do benefício, conforme previsto no § 2º do artigo 99 do Código de Processo Civil.

Por ser verdade, assino a presente declaração, para que produza seus efeitos legais e jurídicos, na forma do artigo 5º, incisos LXXIV e XXXIV, "a" da Constituição Federal.`;

export const DeclaracaoGenerator = ({ 
  open, 
  onOpenChange, 
  client, 
  qualification 
}: DeclaracaoGeneratorProps) => {
  const [localQualification, setLocalQualification] = useState(qualification);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [gerandoPDF, setGerandoPDF] = useState(false);

  useEffect(() => {
    setLocalQualification(qualification);
  }, [qualification]);

  // Gerar texto da declaração para preview
  const gerarTextoDeclaracao = (): string => {
    if (!client) return "";
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    // Remover ponto e vírgula do final da qualificação
    const qualificacaoLimpa = localQualification.replace(/[;,.]$/, '').trim();
    
    // Nome do cliente em maiúsculo para a qualificação
    const nomeCliente = client.nomeCompleto.toUpperCase();
    
    // Substituir o nome na qualificação pelo nome em maiúsculo (início da qualificação)
    let qualificacaoComNomeMaiusculo = qualificacaoLimpa;
    if (qualificacaoLimpa.toLowerCase().startsWith(client.nomeCompleto.toLowerCase())) {
      qualificacaoComNomeMaiusculo = nomeCliente + qualificacaoLimpa.substring(client.nomeCompleto.length);
    }
    
    let texto = `DECLARAÇÃO DE HIPOSSUFICIÊNCIA

${qualificacaoComNomeMaiusculo} ${TEXTO_DECLARACAO}

Belo Horizonte, ${dataAtual}.


_____________________________________
${nomeCliente}`;
    
    return texto;
  };

  // Abrir preview
  const abrirPreview = () => {
    const texto = gerarTextoDeclaracao();
    setPreviewText(texto);
    setShowPreview(true);
  };

  // Voltar para início (não há edição neste componente simplificado)
  const voltarParaInicio = () => {
    setShowPreview(false);
  };

  // Gerar PDF da declaração conforme modelo oficial EXATO
  // Se a prévia foi editada, sincronizar os campos antes
  const gerarPDF = async () => {
    if (!client) return;
    
    // Se a prévia foi editada, extrair qualificação atualizada
    if (showPreview && previewText) {
      const matchQual = previewText.match(/DECLARAÇÃO DE HIPOSSUFICIÊNCIA\s*\n\n([\s\S]*?)\s*venho,\s*respeitosamente/);
      if (matchQual) {
        setLocalQualification(matchQual[1].trim());
      }
    }
    
    setGerandoPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 20;
      const marginRight = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      
      // Adicionar logo centralizada
      try {
        const img = new Image();
        img.src = logoEggnunes;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        const logoWidth = 40;
        const logoHeight = (img.height / img.width) * logoWidth;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(img, 'PNG', logoX, 15, logoWidth, logoHeight);
      } catch (e) {
        console.warn('Não foi possível carregar a logo:', e);
      }

      let yPosition = 42;
      
      // Título centralizado e em negrito
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DECLARAÇÃO DE HIPOSSUFICIÊNCIA', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 14;

      // Remover ponto e vírgula do final da qualificação se existir
      const qualificacaoLimpa = localQualification.replace(/[;,.]$/, '').trim();
      
      // Nome do cliente em maiúsculo
      const nomeCliente = client.nomeCompleto.toUpperCase();
      
      // Tamanho da fonte
      const fontSize = 11;
      const lineHeight = fontSize * 0.5;
      
      // Nome do cliente em NEGRITO e MAIÚSCULO
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      
      // Calcular largura do nome
      const larguraNome = doc.getTextWidth(nomeCliente);
      
      // Renderizar nome em negrito
      doc.text(nomeCliente, marginLeft, yPosition);
      
      // Resto da qualificação (sem o nome no início)
      let restoQualificacao = qualificacaoLimpa;
      if (qualificacaoLimpa.toLowerCase().startsWith(client.nomeCompleto.toLowerCase())) {
        restoQualificacao = qualificacaoLimpa.substring(client.nomeCompleto.length);
      }
      
      // Texto completo após o nome
      const textoCompleto = restoQualificacao + ' ' + TEXTO_DECLARACAO;
      
      doc.setFont('helvetica', 'normal');
      
      // Função para justificar um parágrafo
      const renderJustifiedParagraph = (text: string, startY: number, firstLineIndent: number = 0, firstLineStartX: number = marginLeft) => {
        const palavras = text.split(/\s+/).filter(p => p.trim());
        const lines: string[][] = [];
        let currentLine: string[] = [];
        let currentWidth = 0;
        const spaceW = doc.getTextWidth(' ');
        
        // Para a primeira linha, considerar o indent
        let availableWidth = firstLineIndent > 0 ? (contentWidth - firstLineIndent) : contentWidth;
        let isFirstLine = true;
        
        for (const word of palavras) {
          const wordW = doc.getTextWidth(word);
          const neededWidth = currentWidth > 0 ? spaceW + wordW : wordW;
          
          if (currentWidth + neededWidth > availableWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [word];
            currentWidth = wordW;
            if (isFirstLine) {
              isFirstLine = false;
              availableWidth = contentWidth;
            }
          } else {
            currentLine.push(word);
            currentWidth += neededWidth;
          }
        }
        if (currentLine.length > 0) lines.push(currentLine);
        
        let y = startY;
        for (let i = 0; i < lines.length; i++) {
          const lineWords = lines[i];
          const isLast = i === lines.length - 1;
          const isFirst = i === 0 && firstLineIndent > 0;
          const lineStartX = isFirst ? firstLineStartX : marginLeft;
          const lineWidth = isFirst ? (contentWidth - firstLineIndent) : contentWidth;
          
          let totalWordsW = 0;
          for (const w of lineWords) totalWordsW += doc.getTextWidth(w);
          
          const gaps = lineWords.length - 1;
          // Última linha não justifica
          const justSpaceW = (!isLast && gaps > 0) ? (lineWidth - totalWordsW) / gaps : spaceW;
          
          let x = lineStartX;
          for (let j = 0; j < lineWords.length; j++) {
            doc.text(lineWords[j], x, y);
            x += doc.getTextWidth(lineWords[j]);
            if (j < lineWords.length - 1) x += justSpaceW;
          }
          y += lineHeight;
        }
        return y;
      };
      
      // Dividir em parágrafos (separados por \n\n)
      const paragrafos = textoCompleto.split(/\n\n+/);
      
      for (let pIdx = 0; pIdx < paragrafos.length; pIdx++) {
        const paragrafo = paragrafos[pIdx].replace(/\n/g, ' ').trim();
        if (!paragrafo) continue;
        
        if (pIdx === 0) {
          // Primeiro parágrafo começa após o nome em negrito
          const espacoPrimeiraLinha = contentWidth - larguraNome - 2;
          const palavras = paragrafo.split(/\s+/).filter(p => p.trim());
          let primeiraLinhaPalavras: string[] = [];
          let primeiraLinhaWidth = 0;
          let indiceInicio = 0;
          const spaceW = doc.getTextWidth(' ');
          
          for (let i = 0; i < palavras.length; i++) {
            const wordW = doc.getTextWidth(palavras[i]);
            const neededW = primeiraLinhaWidth > 0 ? spaceW + wordW : wordW;
            if (primeiraLinhaWidth + neededW <= espacoPrimeiraLinha) {
              primeiraLinhaPalavras.push(palavras[i]);
              primeiraLinhaWidth += neededW;
              indiceInicio = i + 1;
            } else {
              break;
            }
          }
          
          // Justificar primeira linha após o nome
          if (primeiraLinhaPalavras.length > 1) {
            let totalW = 0;
            for (const w of primeiraLinhaPalavras) totalW += doc.getTextWidth(w);
            const gaps = primeiraLinhaPalavras.length - 1;
            const justSpace = (espacoPrimeiraLinha - totalW) / gaps;
            
            let xPos = marginLeft + larguraNome + 1;
            for (let i = 0; i < primeiraLinhaPalavras.length; i++) {
              doc.text(primeiraLinhaPalavras[i], xPos, yPosition);
              xPos += doc.getTextWidth(primeiraLinhaPalavras[i]);
              if (i < primeiraLinhaPalavras.length - 1) xPos += justSpace;
            }
          } else if (primeiraLinhaPalavras.length === 1) {
            doc.text(primeiraLinhaPalavras[0], marginLeft + larguraNome + 1, yPosition);
          }
          yPosition += lineHeight;
          
          // Resto do primeiro parágrafo
          const textoRestante = palavras.slice(indiceInicio).join(' ');
          if (textoRestante.trim()) {
            yPosition = renderJustifiedParagraph(textoRestante, yPosition);
          }
        } else {
          // Demais parágrafos
          yPosition = renderJustifiedParagraph(paragrafo, yPosition);
        }
        
        // Espaço entre parágrafos
        yPosition += lineHeight * 0.5;
      }

      yPosition += 10;

      // Data
      const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`Belo Horizonte, ${dataAtual}.`, marginLeft, yPosition);
      
      yPosition += 20;

      // Linha de assinatura
      doc.setLineWidth(0.3);
      const lineStartX = (pageWidth - 80) / 2;
      doc.line(lineStartX, yPosition, lineStartX + 80, yPosition);
      
      yPosition += 5;

      // Nome do cliente em MAIÚSCULO e NEGRITO
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(nomeCliente, pageWidth / 2, yPosition, { align: 'center' });

      // Rodapé com informações do escritório (igual ao contrato e procuração)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('31 3226-8742 | escritorio@eggnunes.com.br | www.eggnunes.com.br', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('Rua São Paulo, 1104 - 9º andar - Centro - Belo Horizonte - MG - 30170-131', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Resetar cor do texto
      doc.setTextColor(0, 0, 0);

      // Salvar o PDF
      const nomeArquivo = `Declaracao_Hipossuficiencia_${client.nomeCompleto.replace(/\s+/g, '_')}.pdf`;
      doc.save(nomeArquivo);
      
      toast.success("Declaração gerada com sucesso!");
      onOpenChange(false);
      setShowPreview(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Declaração de Hipossuficiência - {client.nomeCompleto}
          </DialogTitle>
          <DialogDescription>
            Gere a declaração de hipossuficiência para justiça gratuita
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {showPreview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Prévia da Declaração
                </h3>
                <Button variant="outline" size="sm" onClick={voltarParaInicio}>
                  <Edit className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </div>
              
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Prévia da declaração..."
              />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Qualificação do cliente */}
              <div className="space-y-2">
                <h3 className="font-medium">Qualificação do Cliente</h3>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {qualification}
                </div>
              </div>

              {/* Preview do texto da declaração */}
              <div className="space-y-2">
                <h3 className="font-medium">Texto da Declaração</h3>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {TEXTO_DECLARACAO}
                </div>
              </div>

              {/* Nome do cliente (como aparecerá na assinatura) */}
              <div className="space-y-2">
                <h3 className="font-medium">Assinatura</h3>
                <div className="p-3 bg-muted rounded-md text-sm text-center">
                  <span className="font-bold">{client.nomeCompleto.toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={voltarParaInicio}>
                <Edit className="h-4 w-4 mr-2" />
                Voltar e Editar
              </Button>
              <Button onClick={gerarPDF} disabled={gerandoPDF}>
                {gerandoPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Gerar PDF Final
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={abrirPreview}>
                <FileText className="h-4 w-4 mr-2" />
                Visualizar Prévia
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

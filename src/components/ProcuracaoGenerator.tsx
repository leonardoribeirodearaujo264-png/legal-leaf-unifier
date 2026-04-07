import { useState, useEffect, useRef, useCallback } from "react";
import { getPresetPower } from "@/lib/procuracaoPowerPresets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Scale, 
  Loader2, 
  Sparkles, 
  FileText,
  Download,
  Save,
  Trash2,
  Plus,
  Eye,
  Send
} from "lucide-react";
import { ZapSignDialog } from "@/components/ZapSignDialog";
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

interface ProcuracaoGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  qualification: string;
  objetoContrato?: string;
}

interface PowerTemplate {
  id: string;
  name: string;
  description: string;
  is_default?: boolean;
}

// Lista de advogados conforme modelo oficial da procuração (EXATAMENTE como no modelo)
const ADVOGADOS_OFICIAIS = [
  { nome: "GUILHERME ZARDO DA ROCHA", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 93.714" },
  { nome: "MARCOS LUIZ EGG NUNES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 115.283" },
  { nome: "RAFAEL EGG NUNES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 118.395" },
  { nome: "MARCOS GERALDO NUNES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 75.904" },
  { nome: "MARIANA ALVES AMORIM CORRÊA FULGÊNCIO", nacionalidade: "brasileira", estadoCivil: "casada", oab: "advogada inscrita na OAB/MG sob o n. 140.619" },
  { nome: "MARIA CECILIA BELO", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n.179.649" },
  { nome: "WENMISON JOSÉ DA SILVA RODRIGUES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 207.900" },
  { nome: "NÁGILA RODRIGUES", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/SP sob o n. 421.746" },
  { nome: "KARISTON RICHARD SOARES COELHO", nacionalidade: "brasileiro", estadoCivil: "solteiro", oab: "advogado inscrito na OAB/MG sob o n. 231.047" },
  { nome: "RAFAEL FELIPPE MONTI", nacionalidade: "brasileiro", estadoCivil: "solteiro", oab: "advogado inscrito na OAB/MG sob o nº 232.112" },
  { nome: "JÚLIA MOARES DUTRA PEDRA", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n. 199.902" },
  { nome: "JORDÂNIA LUÍZE GUEDES ALMEIDA", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n. 239.069" },
  { nome: "LUDMILA NICEA MATOS DE MAGALHÃES SILVA FIALHO", nacionalidade: "brasileira", estadoCivil: "casada", oab: "advogada inscrita na OAB/MG sob o n. 153.142" },
  { nome: "JENNIFER KAROLINE DARIO DE SÁ", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n. 202.042" },
];

// Endereço do escritório conforme modelo oficial
const ENDERECO_ESCRITORIO = "Rua São Paulo, nº 1.104, 9º andar, nesta capital";

// Texto do corpo da procuração conforme modelo oficial (EXATAMENTE como no modelo)
const TEXTO_PODERES = `aos quais confere(m) os poderes da cláusula "ad judicia", para defesa dos direitos ou interesses do(a) Outorgante perante instância judicial ou administrativa, podendo, para tanto, requerer e assinar o que for necessário, representar o(a) Outorgante junto às repartições públicas, ingressar em juízo como Autor(a), promover as ações ou medidas cautelares que entender cabíveis, arguir exceções, transigir, desistir, renunciar, receber e dar quitação, interpor e seguir os recursos legais, assinar declaração de hipossuficiência econômica, bem como fazer tudo mais que necessário for ao completo desempenho do presente mandato, para o qual lhe são outorgados amplos poderes, inclusive o substabelecimento.`;

export const ProcuracaoGenerator = ({ 
  open, 
  onOpenChange, 
  client, 
  qualification,
  objetoContrato 
}: ProcuracaoGeneratorProps) => {
  const [localQualification, setLocalQualification] = useState(qualification);
  const [temPoderesEspeciais, setTemPoderesEspeciais] = useState(false);
  const [poderesEspeciais, setPoderesEspeciais] = useState("");
  const [gerandoPoderes, setGerandoPoderes] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  
  // Templates de poderes especiais
  const [templates, setTemplates] = useState<PowerTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
   const [showCreateDefaultTemplate, setShowCreateDefaultTemplate] = useState(false);
   const [templateName, setTemplateName] = useState("");
   const [templateSearch, setTemplateSearch] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  // Objeto do contrato detectado automaticamente
  const [objetoContratoDetectado, setObjetoContratoDetectado] = useState<string | null>(null);
  const [loadingContractDraft, setLoadingContractDraft] = useState(false);
  const [poderesGeradosAutomaticamente, setPoderesGeradosAutomaticamente] = useState(false);

  // ZapSign - Assinatura Digital
  const [showZapSignDialog, setShowZapSignDialog] = useState(false);
  const [showZapSignConfirm, setShowZapSignConfirm] = useState(false);
  const [pdfBase64ForZapSign, setPdfBase64ForZapSign] = useState("");
  const [documentNameForZapSign, setDocumentNameForZapSign] = useState("");

  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Refs para auto-save no unmount (evitar stale closures)
  const localQualificationRef = useRef(localQualification);
  const temPoderesEspeciaisRef = useRef(temPoderesEspeciais);
  const poderesEspeciaisRef = useRef(poderesEspeciais);
  const clientRef = useRef(client);
  const userRef = useRef(user);

  useEffect(() => { localQualificationRef.current = localQualification; }, [localQualification]);
  useEffect(() => { temPoderesEspeciaisRef.current = temPoderesEspeciais; }, [temPoderesEspeciais]);
  useEffect(() => { poderesEspeciaisRef.current = poderesEspeciais; }, [poderesEspeciais]);
  useEffect(() => { clientRef.current = client; }, [client]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Função silenciosa de auto-save (sem toast)
  const autoSaveProcuracaoSilently = useCallback(async () => {
    const c = clientRef.current;
    const u = userRef.current;
    if (!c || !u) return;

    const hasData = localQualificationRef.current.trim() || poderesEspeciaisRef.current.trim();
    if (!hasData) return;

    try {
      const draftData = {
        user_id: u.id,
        client_id: c.id,
        client_name: c.nomeCompleto,
        qualification: localQualificationRef.current,
        tem_poderes_especiais: temPoderesEspeciaisRef.current,
        poderes_especiais: poderesEspeciaisRef.current,
      };

      const { data: existing } = await supabase
        .from('procuracao_drafts' as any)
        .select('id')
        .eq('user_id', u.id)
        .eq('client_id', c.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('procuracao_drafts' as any).update(draftData).eq('id', (existing as any).id);
      } else {
        await supabase.from('procuracao_drafts' as any).insert(draftData);
      }
      console.log('Auto-save periódico da procuração executado');
    } catch (error) {
      console.error('Erro no auto-save periódico da procuração:', error);
    }
  }, []);

  // Auto-save periódico (30s) + save no unmount
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      autoSaveProcuracaoSilently();
    }, 30000);

    return () => {
      clearInterval(interval);
      // Fire-and-forget save on unmount/navigation
      autoSaveProcuracaoSilently();
    };
  }, [open, autoSaveProcuracaoSilently]);

  // Sincronizar qualificação local com prop
  useEffect(() => {
    setLocalQualification(qualification);
  }, [qualification]);

  // Auto-load procuração draft when dialog opens
  useEffect(() => {
    const loadProcuracaoDraft = async () => {
      if (!open || !user || !client) return;
      
      try {
        const { data, error } = await supabase
          .from('procuracao_drafts' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('client_id', client.id)
          .maybeSingle();
        
        if (!error && data) {
          const draft = data as any;
          if (draft.qualification) setLocalQualification(draft.qualification);
          if (draft.tem_poderes_especiais) setTemPoderesEspeciais(draft.tem_poderes_especiais);
          if (draft.poderes_especiais) setPoderesEspeciais(draft.poderes_especiais);
          toast.info("Rascunho de procuração restaurado automaticamente");
        }
      } catch (error) {
        console.error('Erro ao carregar rascunho de procuração:', error);
      }
    };

    loadProcuracaoDraft();
  }, [user, open, client]);

  // Carregar rascunho de contrato existente para detectar objeto do contrato
  useEffect(() => {
    const loadContractDraft = async () => {
      if (!open || !user || !client) return;
      
      setLoadingContractDraft(true);
      try {
        const { data, error } = await supabase
          .from('contract_drafts')
          .select('objeto_contrato')
          .eq('client_id', client.id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data?.objeto_contrato) {
          setObjetoContratoDetectado(data.objeto_contrato);
        }
      } catch (error) {
        console.error('Erro ao carregar rascunho de contrato:', error);
      } finally {
        setLoadingContractDraft(false);
      }
    };

    loadContractDraft();
  }, [user, open, client]);

  // Não gerar poderes automaticamente - deixar o usuário clicar no botão
  // useEffect removido para evitar geração automática

  // Função para gerar poderes automaticamente
  const gerarPoderesAutomaticamente = async (objeto: string) => {
    setGerandoPoderes(true);
    setPoderesGeradosAutomaticamente(true);
    try {
      const prompt = `Você é um advogado especialista em procurações advocatícias.

Gere os poderes especiais para uma procuração com base no seguinte objeto do contrato:

${objeto}

INSTRUÇÕES OBRIGATÓRIAS:
- Seja EXTREMAMENTE breve e direto.
- O texto deve começar com: "Esta procuração destina-se exclusivamente para"
- Liste apenas a ação judicial específica relacionada ao objeto.
- Use no máximo 1-2 linhas.
- Não adicione explicações, não seja prolixo.

Exemplo de formato correto:
"Esta procuração destina-se exclusivamente para propor ação de revisão de aposentadoria por invalidez."

Retorne APENAS o texto curto dos poderes especiais, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'lovable'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        setPoderesEspeciais(response.trim());
        toast.success("Poderes especiais gerados automaticamente com base no contrato!");
      }
    } catch (error) {
      console.error('Erro ao gerar poderes especiais automaticamente:', error);
      toast.error("Erro ao gerar poderes especiais. Tente manualmente.");
    } finally {
      setGerandoPoderes(false);
    }
  };

  // Carregar templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!open || !user) return;
      
      setLoadingTemplates(true);
      try {
        // Carregar todos os templates (visíveis para todos os usuários)
        const { data, error } = await supabase
          .from('special_powers_templates')
          .select('id, name, description, is_default')
          .order('is_default', { ascending: false })
          .order('name');
        
        if (error) throw error;
        setTemplates(data || []);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [user, open]);

  // Salvar template (sempre como template geral - acessível a todos)
  const salvarTemplate = async (isDefault: boolean = true) => {
    if (!templateName.trim() || !poderesEspeciais.trim() || !user) {
      toast.error("Preencha o nome e os poderes especiais");
      return;
    }

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('special_powers_templates')
        .insert({
          user_id: null,
          is_default: true,
          name: templateName.trim(),
          description: poderesEspeciais.trim(),
        });

      if (error) throw error;

      // Recarregar templates (todos visíveis para todos)
      const { data } = await supabase
        .from('special_powers_templates')
        .select('id, name, description, is_default')
        .order('is_default', { ascending: false })
        .order('name');
      
      setTemplates(data || []);
      setTemplateName("");
      setShowSaveTemplate(false);
      setShowCreateDefaultTemplate(false);
      toast.success("Template geral salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Deletar template
  const deletarTemplate = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('special_powers_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template excluído");
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      toast.error("Erro ao excluir template");
    }
  };

  // Carregar template selecionado
  const carregarTemplate = (template: PowerTemplate) => {
    setPoderesEspeciais(template.description);
    toast.success(`Template "${template.name}" carregado`);
  };

  // Gerar poderes especiais com IA (manual - quando usuário clica no botão)
  const gerarPoderesComIA = async () => {
    const objetoParaUsar = objetoContrato || objetoContratoDetectado;
    
    setGerandoPoderes(true);
    try {
      const contexto = objetoParaUsar?.trim() 
        ? `Objeto do contrato: ${objetoParaUsar}`
        : `Cliente: ${client?.nomeCompleto || 'não informado'}`;
      
      const prompt = `Você é um advogado especialista em procurações advocatícias.

Gere os poderes especiais para uma procuração com base no seguinte contexto:

${contexto}

Os poderes especiais devem ser específicos e relacionados ao contexto informado, permitindo que o advogado execute todas as ações necessárias para a defesa dos interesses do cliente.

Formato esperado:
- Os poderes devem ser listados de forma clara e direta.
- O texto deve ser em português jurídico formal.
- Seja objetivo e conciso.

Retorne APENAS o texto dos poderes especiais, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'lovable'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        setPoderesEspeciais(response.trim());
        toast.success("Poderes especiais gerados com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar poderes especiais:', error);
      toast.error("Erro ao gerar poderes especiais. Tente novamente.");
    } finally {
      setGerandoPoderes(false);
    }
  };

  // Gerar texto da procuração para preview
  const gerarTextoProcuracao = (): string => {
    if (!client) return "";
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    // Montar lista de advogados
    const advogadosTexto = ADVOGADOS_OFICIAIS.map(adv => 
      `${adv.nome}, ${adv.nacionalidade}, ${adv.estadoCivil}, advogado(a) inscrito(a) na ${adv.oab}`
    ).join('\n');
    
    let texto = `PROCURAÇÃO

${localQualification}; nomeia(m) e constitui(em), seus bastantes procuradores os advogados:

${advogadosTexto}

todos com escritório na ${ENDERECO_ESCRITORIO}, ${TEXTO_PODERES}`;

    // Inserir poderes especiais se houver
    if (temPoderesEspeciais && poderesEspeciais.trim()) {
      texto += `\n\n${poderesEspeciais.trim()}`;
    }
    
    texto += `\n\nBelo Horizonte, ${dataAtual}.\n\n\n_____________________________________\n${client.nomeCompleto.toUpperCase()}`;
    
    return texto;
  };

  // Abrir preview
  const abrirPreview = () => {
    const texto = gerarTextoProcuracao();
    setPreviewText(texto);
    setShowPreview(true);
  };

  // Voltar para edição
  const voltarParaEdicao = () => {
    setShowPreview(false);
  };

  // Gerar PDF da procuração conforme modelo oficial EXATO
  const gerarPDF = async () => {
    if (!client) return;
    
    setGerandoPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 15;
      const marginRight = 15;
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
        doc.addImage(img, 'PNG', logoX, 10, logoWidth, logoHeight);
      } catch (e) {
        console.warn('Não foi possível carregar a logo:', e);
      }

      let yPosition = 32;
      
      // Título PROCURAÇÃO em negrito e centralizado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PROCURAÇÃO', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Nome do cliente em MAIÚSCULO e NEGRITO
      const nomeCliente = client.nomeCompleto.toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      // Calcular largura do nome
      const larguraNome = doc.getTextWidth(nomeCliente);
      
      // Renderizar nome em negrito e maiúsculo
      doc.text(nomeCliente, marginLeft, yPosition);
      
      // Resto da qualificação em fonte normal (sem o nome)
      const qualificacaoLimpa = localQualification.replace(/[;,.]$/, '').trim();
      let restoQualificacao = qualificacaoLimpa;
      
      // Remover o nome do início da qualificação
      if (qualificacaoLimpa.toLowerCase().startsWith(client.nomeCompleto.toLowerCase())) {
        restoQualificacao = qualificacaoLimpa.substring(client.nomeCompleto.length);
      }
      
      // Adicionar o texto que vem depois + sufixo da procuração
      const textoAposNome = restoQualificacao + "; nomeia(m) e constitui(em), seus bastantes procuradores os advogados:";
      
      doc.setFont('helvetica', 'normal');
      
      // Função auxiliar para justificar texto manualmente
      const renderJustifiedText = (text: string, startX: number, startY: number, maxWidth: number, lineH: number) => {
        const allWords = text.split(/\s+/).filter(w => w);
        const lines: string[][] = [];
        let currentLine: string[] = [];
        let currentWidth = 0;
        const spaceW = doc.getTextWidth(' ');
        
        for (const word of allWords) {
          const wordW = doc.getTextWidth(word);
          const neededWidth = currentWidth > 0 ? spaceW + wordW : wordW;
          
          if (currentWidth + neededWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [word];
            currentWidth = wordW;
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
          
          let totalWordsW = 0;
          for (const w of lineWords) totalWordsW += doc.getTextWidth(w);
          
          const gaps = lineWords.length - 1;
          const justSpaceW = (!isLast && gaps > 0) ? (maxWidth - totalWordsW) / gaps : spaceW;
          
          let x = startX;
          for (let j = 0; j < lineWords.length; j++) {
            doc.text(lineWords[j], x, y);
            x += doc.getTextWidth(lineWords[j]);
            if (j < lineWords.length - 1) x += justSpaceW;
          }
          y += lineH;
        }
        return y;
      };
      
      // Calcular quanto cabe na primeira linha após o nome (justificado manualmente)
      const espacoPrimeiraLinha = contentWidth - larguraNome - 2;
      const palavras = textoAposNome.split(/\s+/).filter(w => w);
      let primeiraLinhaPalavras: string[] = [];
      let primeiraLinhaWidth = 0;
      let indiceInicio = 0;
      const spaceWidth = doc.getTextWidth(' ');
      
      for (let i = 0; i < palavras.length; i++) {
        const wordW = doc.getTextWidth(palavras[i]);
        const neededW = primeiraLinhaWidth > 0 ? spaceWidth + wordW : wordW;
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
      yPosition += 4;
      
      // Resto do texto justificado
      const textoRestante = palavras.slice(indiceInicio).join(' ');
      if (textoRestante.trim()) {
        yPosition = renderJustifiedText(textoRestante, marginLeft, yPosition, contentWidth, 3.8);
      }
      yPosition += 3;

      // Tabela de advogados (formato tabela conforme modelo)
      doc.setFontSize(7.5);
      const colNome = marginLeft;
      const colNacionalidade = marginLeft + 75;
      const colEstadoCivil = marginLeft + 95;
      const colOab = marginLeft + 115;
      const lineHeightTable = 3.5;
      
      for (const adv of ADVOGADOS_OFICIAIS) {
        doc.setFont('helvetica', 'bold');
        doc.text(adv.nome, colNome, yPosition);
        
        doc.setFont('helvetica', 'normal');
        doc.text(adv.nacionalidade, colNacionalidade, yPosition);
        doc.text(adv.estadoCivil, colEstadoCivil, yPosition);
        doc.text(adv.oab, colOab, yPosition);
        
        yPosition += lineHeightTable;
      }

      yPosition += 2;

      // Texto do escritório + poderes (sem poderes especiais aqui) - JUSTIFICADO
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const textoPoderesCompleto = `todos com escritório na ${ENDERECO_ESCRITORIO}, ${TEXTO_PODERES}`;
      
      // Usar justificação manual para o texto dos poderes
      const renderJustifiedPoderes = (text: string, startY: number) => {
        const allWords = text.split(/\s+/).filter(w => w);
        const lines: string[][] = [];
        let currentLine: string[] = [];
        let currentWidth = 0;
        const spaceW = doc.getTextWidth(' ');
        
        for (const word of allWords) {
          const wordW = doc.getTextWidth(word);
          const neededWidth = currentWidth > 0 ? spaceW + wordW : wordW;
          
          if (currentWidth + neededWidth > contentWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [word];
            currentWidth = wordW;
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
          
          let totalWordsW = 0;
          for (const w of lineWords) totalWordsW += doc.getTextWidth(w);
          
          const gaps = lineWords.length - 1;
          const justSpaceW = (!isLast && gaps > 0) ? (contentWidth - totalWordsW) / gaps : spaceW;
          
          let x = marginLeft;
          for (let j = 0; j < lineWords.length; j++) {
            doc.text(lineWords[j], x, y);
            x += doc.getTextWidth(lineWords[j]);
            if (j < lineWords.length - 1) x += justSpaceW;
          }
          y += 3.8;
        }
        return y;
      };
      
      yPosition = renderJustifiedPoderes(textoPoderesCompleto, yPosition);
      
      // Poderes especiais ao FINAL, em NEGRITO, separado - também justificado
      if (temPoderesEspeciais && poderesEspeciais.trim()) {
        yPosition += 4;
        doc.setFont('helvetica', 'bold');
        yPosition = renderJustifiedPoderes(poderesEspeciais.trim(), yPosition);
        doc.setFont('helvetica', 'normal');
      }
      yPosition += 6;

      // Data e local
      const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      doc.text(`Belo Horizonte, ${dataAtual}.`, marginLeft, yPosition);
      yPosition += 20;

      // Espaço maior para assinatura eletrônica
      yPosition += 10;

      // Linha de assinatura centralizada
      doc.text('_____________________________________', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
      
      // Nome do cliente em negrito e centralizado
      doc.setFont('helvetica', 'bold');
      doc.text(client.nomeCompleto.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });

      // Rodapé conforme modelo exato
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('31 3226-8742 | escritorio@eggnunes.com.br | www.eggnunes.com.br', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('Rua São Paulo, 1104 - 9º andar - Centro - Belo Horizonte - MG - 30170-131', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Gerar PDF e base64
      const nomeArquivo = `Procuracao_${client.nomeCompleto.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`;
      
      // Gerar base64 para ZapSign
      const pdfOutput = doc.output('arraybuffer');
      const uint8Array = new Uint8Array(pdfOutput);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Content = btoa(binary);
      
      // Salvar dados para ZapSign
      setPdfBase64ForZapSign(base64Content);
      setDocumentNameForZapSign(nomeArquivo.replace('.pdf', ''));
      
      // Salvar PDF no download
      doc.save(nomeArquivo);
      
      // Perguntar se deseja enviar para assinatura digital
      setShowZapSignConfirm(true);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (!client) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={async (isOpen) => {
      if (!isOpen && client && user) {
        // Auto-save draft silently on close if there's data
        const hasData = localQualification.trim() || poderesEspeciais.trim();
        if (hasData) {
          try {
            const draftData = {
              user_id: user.id,
              client_id: client.id,
              client_name: client.nomeCompleto,
              qualification: localQualification,
              tem_poderes_especiais: temPoderesEspeciais,
              poderes_especiais: poderesEspeciais,
            };

            const { data: existing } = await supabase
              .from('procuracao_drafts' as any)
              .select('id')
              .eq('user_id', user.id)
              .eq('client_id', client.id)
              .maybeSingle();

            if (existing) {
              await supabase.from('procuracao_drafts' as any).update(draftData).eq('id', (existing as any).id);
            } else {
              await supabase.from('procuracao_drafts' as any).insert(draftData);
            }
            console.log('Rascunho de procuração salvo automaticamente');
          } catch (error) {
            console.error('Erro ao auto-salvar rascunho de procuração:', error);
          }
        }
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Gerar Procuração
          </DialogTitle>
          <DialogDescription>
            Procuração para {client.nomeCompleto?.split(' ')[0]}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          {showPreview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  <FileText className="h-3 w-3 mr-1" />
                  Pré-visualização da Procuração
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Edite o texto abaixo se necessário
                </p>
              </div>
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                className="min-h-[50vh] font-mono text-sm leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Qualificação */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Qualificação do Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={localQualification}
                    onChange={(e) => setLocalQualification(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="Qualificação do cliente..."
                  />
                </CardContent>
              </Card>

              {/* Poderes Especiais */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Poderes Especiais</CardTitle>
                    <Switch
                      checked={temPoderesEspeciais}
                      onCheckedChange={setTemPoderesEspeciais}
                    />
                  </div>
                </CardHeader>
                {temPoderesEspeciais && (
                  <CardContent className="space-y-4">
                    {/* Opção para gerar poderes pelo objeto do contrato */}
                    <div className="space-y-2">
                      {(objetoContrato || objetoContratoDetectado) ? (
                        <>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 text-primary text-sm">
                            <FileText className="h-4 w-4" />
                            <span>
                              {gerandoPoderes 
                                ? "Gerando poderes especiais com base no contrato..." 
                                : "Objeto do contrato detectado"}
                            </span>
                          </div>
                          <div className="p-2 bg-muted rounded-md text-xs max-h-24 overflow-y-auto">
                            {objetoContrato || objetoContratoDetectado}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => gerarPoderesAutomaticamente(objetoContrato || objetoContratoDetectado || '')}
                            className="w-full"
                            disabled={gerandoPoderes}
                          >
                            {gerandoPoderes ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Gerar poderes pelo objeto do contrato
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-muted-foreground text-sm">
                          <FileText className="h-4 w-4" />
                          <span>Nenhum objeto de contrato detectado. Salve um rascunho de contrato primeiro para gerar automaticamente.</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Templates disponíveis */}
                     {templates.length > 0 && (
                       <div className="space-y-2">
                         <div className="flex items-center justify-between">
                           <Label className="text-xs text-muted-foreground">Templates disponíveis</Label>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => setShowCreateDefaultTemplate(true)}
                             className="h-6 text-xs px-2"
                           >
                             {isAdmin ? '+ Novo Template Padrão' : '+ Salvar Template'}
                           </Button>
                         </div>
                         {templates.length > 3 && (
                           <Input
                             placeholder="Buscar template..."
                             value={templateSearch}
                             onChange={(e) => setTemplateSearch(e.target.value)}
                             className="h-8 text-xs"
                           />
                         )}
                         <div className="flex flex-wrap gap-2">
                           {templates.filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())).map((template) => (
                            <div key={template.id} className="flex items-center gap-1">
                              <Badge 
                                variant={template.is_default ? "secondary" : "outline"}
                                className="cursor-pointer hover:bg-primary/10"
                                onClick={() => carregarTemplate(template)}
                              >
                                {template.name}
                                {template.is_default && <span className="ml-1 text-[10px] opacity-60">(padrão)</span>}
                              </Badge>
                              {(!template.is_default || isAdmin) && (
                                <button
                                  onClick={() => deletarTemplate(template.id, template.is_default)}
                                  className="text-muted-foreground hover:text-destructive p-0.5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campo de texto dos poderes */}
                    <div className="space-y-2">
                      <Label>Descreva os poderes especiais *</Label>
                      <Textarea
                        placeholder="Ex: Outorga ainda poderes especiais para requerer a revisão de aposentadoria..."
                        value={poderesEspeciais}
                        onChange={(e) => setPoderesEspeciais(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={gerarPoderesComIA}
                        disabled={gerandoPoderes}
                      >
                        {gerandoPoderes ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Gerar com IA
                      </Button>
                      
                      {poderesEspeciais.trim() && !showSaveTemplate && !showCreateDefaultTemplate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateDefaultTemplate(true)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar como Template Geral
                        </Button>
                      )}
                    </div>

                    {/* Formulário salvar template pessoal */}
                    {showSaveTemplate && (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                        <Label className="text-xs">Nome do template</Label>
                        <Input
                          placeholder="Ex: Poderes Revisão INSS"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => salvarTemplate(false)}
                            disabled={savingTemplate || !templateName.trim()}
                            className="h-8"
                          >
                            {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowSaveTemplate(false);
                              setTemplateName("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                     {/* Formulário criar template */}
                     {showCreateDefaultTemplate && (
                       <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                         <Label className="text-xs font-medium text-primary">
                           {isAdmin ? 'Criar Template Padrão (visível para todos)' : 'Salvar como Template'}
                         </Label>
                        <Input
                          placeholder="Nome do template"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                        <div className="flex gap-2">
                           <Button 
                             size="sm" 
                             onClick={() => salvarTemplate(isAdmin)}
                             disabled={savingTemplate || !templateName.trim() || !poderesEspeciais.trim()}
                             className="h-8"
                           >
                             {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : (isAdmin ? "Criar Template Padrão" : "Salvar Template")}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowCreateDefaultTemplate(false);
                              setTemplateName("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="gap-2">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={voltarParaEdicao}>
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
                <Eye className="h-4 w-4 mr-2" />
                Visualizar Procuração
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog de confirmação ZapSign */}
    <Dialog open={showZapSignConfirm} onOpenChange={setShowZapSignConfirm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar para Assinatura Digital?
          </DialogTitle>
          <DialogDescription>
            A procuração foi gerada com sucesso. Deseja enviá-la para assinatura eletrônica via ZapSign?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowZapSignConfirm(false);
              onOpenChange(false);
              toast.success("Procuração gerada com sucesso!");
            }}
          >
            Não, apenas gerar PDF
          </Button>
          <Button
            onClick={() => {
              setShowZapSignConfirm(false);
              setShowZapSignDialog(true);
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            Sim, enviar para ZapSign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog ZapSign */}
    <ZapSignDialog
      open={showZapSignDialog}
      onOpenChange={(open) => {
        setShowZapSignDialog(open);
        if (!open) {
          onOpenChange(false);
        }
      }}
      documentType="procuracao"
      documentName={documentNameForZapSign}
      pdfBase64={pdfBase64ForZapSign}
      clientName={client?.nomeCompleto || ''}
      clientEmail={client?.email}
      clientPhone={client?.telefone}
      clientCpf={client?.cpf}
      onSuccess={(signUrl) => {
        console.log('Procuração enviada para assinatura:', signUrl);
      }}
    />
    </>
  );
};

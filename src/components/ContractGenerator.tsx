import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  FileSignature, 
  Loader2, 
  Sparkles, 
  CreditCard, 
  Target, 
  Award,
  FileText,
  Download,
  Save,
  FolderOpen,
  Trash2,
  Plus,
  Users,
  FileEdit,
  CloudUpload,
  Send
} from "lucide-react";
import { SaveToTeamsDialog } from "@/components/SaveToTeamsDialog";
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
  comoConheceu?: string;
}

interface ContractGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  productName: string;
  qualification: string;
}

// Todos os produtos agora usam o contrato padrão com templates personalizados
// Lista mantida apenas para referência futura se necessário
// const CUSTOM_CONTRACT_PRODUCTS = [...];

// Helper para formatar múltiplas formas de pagamento
const formatarFormasPagamento = (formas: string[]): string => {
  const mapa: Record<string, string> = {
    'pix': 'PIX',
    'cartao': 'cartão de crédito',
    'boleto': 'boleto bancário'
  };
  
  const textos = formas.map(f => mapa[f] || f);
  
  if (textos.length === 1) {
    return `via ${textos[0]}`;
  } else if (textos.length === 2) {
    return `via ${textos[0]} ou ${textos[1]}`;
  } else {
    const ultimo = textos.pop();
    return `via ${textos.join(', ')} ou ${ultimo}`;
  }
};

// Helper para toggle de forma de pagamento em array
const toggleFormaPagamentoHelper = (
  formas: string[], 
  forma: string
): string[] => {
  if (formas.includes(forma)) {
    // Não permitir desmarcar se for a única opção
    if (formas.length > 1) {
      return formas.filter(f => f !== forma);
    }
    return formas;
  } else {
    return [...formas, forma];
  }
};

// Interface para opção de honorário inicial
interface InitialFeeOption {
  id: string;
  tipoHonorarios: "avista" | "parcelado";
  valorTotal: string;
  numeroParcelas: string;
  valorParcela: string;
  temEntrada: boolean;
  valorEntrada: string;
  formasPagamentoEntrada: string[];
  formasPagamentoParcelas: string[];
  formasPagamento: string[];
  dataVencimento: string;
}

// Interface para opção de êxito
interface ExitoOption {
  id: string;
  descricao: string;
  clausulaGerada: string;
  gerando: boolean;
}

// Interface para template simples
interface SimpleTemplate { 
  id: string; 
  name: string; 
  description: string; 
  is_default?: boolean; 
}

// Interface para template de honorários iniciais
interface InitialFeeTemplate {
  id: string;
  name: string;
  tipo_honorarios: string;
  valor_total?: string;
  numero_parcelas?: string;
  valor_parcela?: string;
  tem_entrada?: boolean;
  valor_entrada?: string;
  forma_pagamento?: string;
  forma_pagamento_entrada?: string;
  forma_pagamento_parcelas?: string;
  descricao?: string;
  is_default?: boolean;
}

export const ContractGenerator = ({ 
  open, 
  onOpenChange, 
  client, 
  productName,
  qualification 
}: ContractGeneratorProps) => {
  // Cláusula Primeira - Objeto do contrato
  const [contraPartida, setContraPartida] = useState("");
  const [objetoContrato, setObjetoContrato] = useState("");
  const [clausulaPrimeiraGerada, setClausulaPrimeiraGerada] = useState("");
  const [gerandoClausulaPrimeira, setGerandoClausulaPrimeira] = useState(false);

  // Templates de parte contrária
  const [contraPartidaTemplates, setContraPartidaTemplates] = useState<SimpleTemplate[]>([]);
  const [showSaveContraPartidaTemplate, setShowSaveContraPartidaTemplate] = useState(false);
  const [showCreateDefaultContraPartidaTemplate, setShowCreateDefaultContraPartidaTemplate] = useState(false);
  const [contraPartidaTemplateName, setContraPartidaTemplateName] = useState("");
  const [savingContraPartidaTemplate, setSavingContraPartidaTemplate] = useState(false);

  // Templates de objeto do contrato
  const [objetoContratoTemplates, setObjetoContratoTemplates] = useState<SimpleTemplate[]>([]);
  const [showSaveObjetoContratoTemplate, setShowSaveObjetoContratoTemplate] = useState(false);
  const [showCreateDefaultObjetoContratoTemplate, setShowCreateDefaultObjetoContratoTemplate] = useState(false);
  const [objetoContratoTemplateName, setObjetoContratoTemplateName] = useState("");
  const [savingObjetoContratoTemplate, setSavingObjetoContratoTemplate] = useState(false);

  // Cláusula Terceira - Honorários Iniciais - Múltiplas opções
  const [temHonorariosIniciais, setTemHonorariosIniciais] = useState(true);
  const [initialFeeOptions, setInitialFeeOptions] = useState<InitialFeeOption[]>([{
    id: crypto.randomUUID(),
    tipoHonorarios: "avista",
    valorTotal: "",
    numeroParcelas: "",
    valorParcela: "",
    temEntrada: false,
    valorEntrada: "",
    formasPagamentoEntrada: ["pix"],
    formasPagamentoParcelas: ["boleto"],
    formasPagamento: ["pix"],
    dataVencimento: "",
  }]);

  // Honorários Êxito - Múltiplas opções
  const [temHonorariosExito, setTemHonorariosExito] = useState(false);
  const [exitoOptions, setExitoOptions] = useState<ExitoOption[]>([
    { id: crypto.randomUUID(), descricao: "", clausulaGerada: "", gerando: false }
  ]);
  
  // Templates de honorários êxito
  const [templates, setTemplates] = useState<SimpleTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showCreateDefaultExitoTemplate, setShowCreateDefaultExitoTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Templates de honorários iniciais
  const [initialFeeTemplates, setInitialFeeTemplates] = useState<InitialFeeTemplate[]>([]);
  const [showSaveInitialTemplate, setShowSaveInitialTemplate] = useState(false);
  const [showCreateDefaultTemplate, setShowCreateDefaultTemplate] = useState(false);
  const [initialTemplateName, setInitialTemplateName] = useState("");
  const [initialTemplateDescricao, setInitialTemplateDescricao] = useState("");
  const [savingInitialTemplate, setSavingInitialTemplate] = useState(false);

  // Associação de templates por produto
  const [productAssociationId, setProductAssociationId] = useState<string | null>(null);
  const [selectedContraPartidaTemplateId, setSelectedContraPartidaTemplateId] = useState<string | null>(null);
  const [selectedObjetoContratoTemplateId, setSelectedObjetoContratoTemplateId] = useState<string | null>(null);
  const [savingProductAssociation, setSavingProductAssociation] = useState(false);

  // Geração do contrato
  const [gerandoContrato, setGerandoContrato] = useState(false);
  
  // Pré-visualização
  const [showPreview, setShowPreview] = useState(false);
  const [contractPreviewText, setContractPreviewText] = useState("");

  // Rascunhos
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [carregandoRascunho, setCarregandoRascunho] = useState(false);
  const [rascunhoExistente, setRascunhoExistente] = useState<string | null>(null);
  const [deletandoRascunho, setDeletandoRascunho] = useState(false);

  // Salvar no Teams
  const [showSaveToTeams, setShowSaveToTeams] = useState(false);
  const [pdfForTeams, setPdfForTeams] = useState<{ fileName: string; content: string } | null>(null);

  // ZapSign - Assinatura Digital
  const [showZapSignDialog, setShowZapSignDialog] = useState(false);
  const [showZapSignConfirm, setShowZapSignConfirm] = useState(false);
  const [pdfBase64ForZapSign, setPdfBase64ForZapSign] = useState("");
  const [documentNameForZapSign, setDocumentNameForZapSign] = useState("");

  const { user } = useAuth();
 
  // ID do contrato registrado no banco (para vincular ao ZapSign e cadastro manual ADVBox)
  const [contratoId, setContratoId] = useState<string | null>(null);
  
  // Diálogo para cadastro manual no ADVBox (quando não envia para ZapSign)
  const [showAdvboxManualConfirm, setShowAdvboxManualConfirm] = useState(false);
  const [registrandoAdvboxManual, setRegistrandoAdvboxManual] = useState(false);
 
  const { isAdmin } = useUserRole();

  // Refs para auto-save no unmount (evitar stale closures)
  const contraPartidaRef = useRef(contraPartida);
  const objetoContratoRef = useRef(objetoContrato);
  const clausulaPrimeiraGeradaRef = useRef(clausulaPrimeiraGerada);
  const initialFeeOptionsRef = useRef(initialFeeOptions);
  const temHonorariosExitoRef = useRef(temHonorariosExito);
  const exitoOptionsRef = useRef(exitoOptions);
  const contractPreviewTextRef = useRef(contractPreviewText);
  const rascunhoExistenteRef = useRef(rascunhoExistente);
  const clientRef = useRef(client);
  const userRef = useRef(user);

  useEffect(() => { contraPartidaRef.current = contraPartida; }, [contraPartida]);
  useEffect(() => { objetoContratoRef.current = objetoContrato; }, [objetoContrato]);
  useEffect(() => { clausulaPrimeiraGeradaRef.current = clausulaPrimeiraGerada; }, [clausulaPrimeiraGerada]);
  useEffect(() => { initialFeeOptionsRef.current = initialFeeOptions; }, [initialFeeOptions]);
  useEffect(() => { temHonorariosExitoRef.current = temHonorariosExito; }, [temHonorariosExito]);
  useEffect(() => { exitoOptionsRef.current = exitoOptions; }, [exitoOptions]);
  useEffect(() => { contractPreviewTextRef.current = contractPreviewText; }, [contractPreviewText]);
  useEffect(() => { rascunhoExistenteRef.current = rascunhoExistente; }, [rascunhoExistente]);
  useEffect(() => { clientRef.current = client; }, [client]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Função silenciosa de auto-save (sem toast)
  const autoSaveSilently = useCallback(async () => {
    const c = clientRef.current;
    const u = userRef.current;
    if (!c || !u) return;

    const hasData = contraPartidaRef.current.trim() || objetoContratoRef.current.trim() || 
      clausulaPrimeiraGeradaRef.current.trim() || 
      initialFeeOptionsRef.current.some(o => o.valorTotal.trim()) || 
      exitoOptionsRef.current.some(o => o.descricao.trim());
    if (!hasData) return;

    try {
      const firstOption = initialFeeOptionsRef.current[0];
      const draftData = {
        user_id: u.id,
        client_id: c.id,
        client_name: c.nomeCompleto,
        product_name: productName,
        qualification: qualification,
        contra_partida: contraPartidaRef.current,
        objeto_contrato: objetoContratoRef.current,
        clausula_primeira_gerada: clausulaPrimeiraGeradaRef.current,
        tipo_honorarios: firstOption?.tipoHonorarios || "avista",
        valor_total: firstOption?.valorTotal || "",
        numero_parcelas: firstOption?.numeroParcelas || "",
        valor_parcela: firstOption?.valorParcela || "",
        tem_entrada: firstOption?.temEntrada || false,
        valor_entrada: firstOption?.valorEntrada || "",
        forma_pagamento: firstOption?.formasPagamento.join(',') || "pix",
        data_vencimento: firstOption?.dataVencimento || "",
        tem_honorarios_exito: temHonorariosExitoRef.current,
        descricao_honorarios_exito: exitoOptionsRef.current.map(o => o.descricao).join(' | '),
        clausula_exito_gerada: exitoOptionsRef.current.map(o => o.clausulaGerada).join('\n\n'),
        contract_preview_text: contractPreviewTextRef.current,
      };

      const existingId = rascunhoExistenteRef.current;
      if (existingId) {
        await supabase.from('contract_drafts').update(draftData).eq('id', existingId);
      } else {
        const { data } = await supabase.from('contract_drafts').insert(draftData).select('id').single();
        if (data) rascunhoExistenteRef.current = data.id;
      }
      console.log('Auto-save periódico do contrato executado');
    } catch (error) {
      console.error('Erro no auto-save periódico do contrato:', error);
    }
  }, [productName, qualification]);

  // Auto-save periódico (30s) + save no unmount
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      autoSaveSilently();
    }, 30000);

    return () => {
      clearInterval(interval);
      // Fire-and-forget save on unmount/navigation
      autoSaveSilently();
    };
  }, [open, autoSaveSilently]);

  // Carregar todos os templates
  useEffect(() => {
    const loadAllTemplates = async () => {
      if (!open || !user) return;
      
      setLoadingTemplates(true);
      try {
        // Carregar templates de êxito
        const { data: successData } = await supabase
          .from('success_fee_templates')
          .select('id, name, description, is_default')
          .or(`user_id.eq.${user.id},is_default.eq.true`)
          .order('is_default', { ascending: false })
          .order('name');
        
        setTemplates(successData || []);

        // Carregar templates de honorários iniciais (todos os templates visíveis para todos)
        const { data: initialData } = await supabase
          .from('initial_fee_templates')
          .select('*')
          .order('is_default', { ascending: false })
          .order('name');
        
        setInitialFeeTemplates(initialData || []);

        // Carregar templates de parte contrária (todos os templates visíveis para todos)
        const { data: contraPartidaData } = await supabase
          .from('contra_partida_templates')
          .select('id, name, description, is_default')
          .order('is_default', { ascending: false })
          .order('name');
        
        setContraPartidaTemplates(contraPartidaData || []);

        // Carregar templates de objeto do contrato (todos os templates visíveis para todos)
        const { data: objetoData } = await supabase
          .from('objeto_contrato_templates')
          .select('id, name, description, is_default')
          .order('is_default', { ascending: false })
          .order('name');
        
        setObjetoContratoTemplates(objetoData || []);

        // Carregar associação de templates por produto
        if (productName) {
          const { data: assocData } = await supabase
            .from('product_template_associations')
            .select('*')
            .eq('user_id', user.id)
            .eq('product_name', productName)
            .maybeSingle();
          
          if (assocData) {
            setProductAssociationId(assocData.id);
            // Carregar templates associados e definir IDs selecionados
            if (assocData.contra_partida_template_id) {
              setSelectedContraPartidaTemplateId(assocData.contra_partida_template_id);
              const template = contraPartidaData?.find(t => t.id === assocData.contra_partida_template_id);
              if (template) setContraPartida(template.description);
            }
            if (assocData.objeto_contrato_template_id) {
              setSelectedObjetoContratoTemplateId(assocData.objeto_contrato_template_id);
              const template = objetoData?.find(t => t.id === assocData.objeto_contrato_template_id);
              if (template) setObjetoContrato(template.description);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadAllTemplates();
  }, [user, open, productName]);

  // Verificar se existe rascunho para este cliente
  useEffect(() => {
    const checkExistingDraft = async () => {
      if (!client || !user) return;
      
      const { data } = await supabase
        .from('contract_drafts')
        .select('id')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setRascunhoExistente(data.id);
        // Auto-load: carregar rascunho automaticamente
        setCarregandoRascunho(true);
        try {
          const { data: draftData, error: draftError } = await supabase
            .from('contract_drafts')
            .select('*')
            .eq('id', data.id)
            .single();
          
          if (!draftError && draftData) {
            setContraPartida(draftData.contra_partida || "");
            setObjetoContrato(draftData.objeto_contrato || "");
            setClausulaPrimeiraGerada(draftData.clausula_primeira_gerada || "");
            if (initialFeeOptions.length > 0) {
              const firstOption = initialFeeOptions[0];
              atualizarOpcaoInicial(firstOption.id, 'tipoHonorarios', (draftData.tipo_honorarios as "avista" | "parcelado") || "avista");
              atualizarOpcaoInicial(firstOption.id, 'valorTotal', draftData.valor_total || "");
              atualizarOpcaoInicial(firstOption.id, 'numeroParcelas', draftData.numero_parcelas || "");
              atualizarOpcaoInicial(firstOption.id, 'valorParcela', draftData.valor_parcela || "");
              atualizarOpcaoInicial(firstOption.id, 'temEntrada', draftData.tem_entrada || false);
              atualizarOpcaoInicial(firstOption.id, 'valorEntrada', draftData.valor_entrada || "");
              atualizarOpcaoInicial(firstOption.id, 'formasPagamento', draftData.forma_pagamento ? draftData.forma_pagamento.split(',') : ["pix"]);
              atualizarOpcaoInicial(firstOption.id, 'dataVencimento', draftData.data_vencimento || "");
            }
            setTemHonorariosExito(draftData.tem_honorarios_exito || false);
            if (draftData.descricao_honorarios_exito || draftData.clausula_exito_gerada) {
              setExitoOptions([{
                id: crypto.randomUUID(),
                descricao: draftData.descricao_honorarios_exito || "",
                clausulaGerada: draftData.clausula_exito_gerada || "",
                gerando: false
              }]);
            }
            setContractPreviewText(draftData.contract_preview_text || "");
            toast.info("Rascunho anterior restaurado automaticamente");
          }
        } catch (error) {
          console.error('Erro ao auto-carregar rascunho:', error);
        } finally {
          setCarregandoRascunho(false);
        }
      } else {
        setRascunhoExistente(null);
      }
    };

    if (open) {
      checkExistingDraft();
    }
  }, [client, user, open]);

  // Funções para gerenciar templates de parte contrária
  const salvarContraPartidaTemplate = async (isDefault: boolean = false) => {
    if (!contraPartidaTemplateName.trim() || !contraPartida.trim() || !user) {
      toast.error("Preencha o nome e a parte contrária");
      return;
    }

    setSavingContraPartidaTemplate(true);
    try {
      const { error } = await supabase
        .from('contra_partida_templates')
        .insert({
          user_id: isDefault ? null : user.id,
          is_default: isDefault,
          name: contraPartidaTemplateName.trim(),
          description: contraPartida.trim(),
        });

      if (error) throw error;

      // Recarregar templates (todos visíveis para todos)
      const { data } = await supabase
        .from('contra_partida_templates')
        .select('id, name, description, is_default')
        .order('is_default', { ascending: false })
        .order('name');
      
      setContraPartidaTemplates(data || []);
      setContraPartidaTemplateName("");
      setShowSaveContraPartidaTemplate(false);
      setShowCreateDefaultContraPartidaTemplate(false);
      toast.success(isDefault ? "Template padrão criado!" : "Template salvo!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingContraPartidaTemplate(false);
    }
  };

  const deletarContraPartidaTemplate = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('contra_partida_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      setContraPartidaTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template excluído");
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      toast.error("Erro ao excluir template");
    }
  };

  // Funções para gerenciar templates de objeto do contrato
  const salvarObjetoContratoTemplate = async (isDefault: boolean = false) => {
    if (!objetoContratoTemplateName.trim() || !objetoContrato.trim() || !user) {
      toast.error("Preencha o nome e o objeto do contrato");
      return;
    }

    setSavingObjetoContratoTemplate(true);
    try {
      const { error } = await supabase
        .from('objeto_contrato_templates')
        .insert({
          user_id: isDefault ? null : user.id,
          is_default: isDefault,
          name: objetoContratoTemplateName.trim(),
          description: objetoContrato.trim(),
        });

      if (error) throw error;

      // Recarregar templates (todos visíveis para todos)
      const { data } = await supabase
        .from('objeto_contrato_templates')
        .select('id, name, description, is_default')
        .order('is_default', { ascending: false })
        .order('name');
      
      setObjetoContratoTemplates(data || []);
      setObjetoContratoTemplateName("");
      setShowSaveObjetoContratoTemplate(false);
      setShowCreateDefaultObjetoContratoTemplate(false);
      toast.success(isDefault ? "Template padrão criado!" : "Template salvo!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingObjetoContratoTemplate(false);
    }
  };

  const deletarObjetoContratoTemplate = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('objeto_contrato_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      setObjetoContratoTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template excluído");
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      toast.error("Erro ao excluir template");
    }
  };

  // Salvar associação de templates por produto
  const salvarAssociacaoProduto = async () => {
    if (!user || !productName) return;
    
    if (!selectedContraPartidaTemplateId && !selectedObjetoContratoTemplateId) {
      toast.error("Selecione pelo menos um template para associar ao produto");
      return;
    }
    
    setSavingProductAssociation(true);
    try {
      if (productAssociationId) {
        // Atualizar
        await supabase
          .from('product_template_associations')
          .update({
            contra_partida_template_id: selectedContraPartidaTemplateId || null,
            objeto_contrato_template_id: selectedObjetoContratoTemplateId || null,
          })
          .eq('id', productAssociationId);
      } else {
        // Criar
        const { data } = await supabase
          .from('product_template_associations')
          .insert({
            user_id: user.id,
            product_name: productName,
            contra_partida_template_id: selectedContraPartidaTemplateId || null,
            objeto_contrato_template_id: selectedObjetoContratoTemplateId || null,
          })
          .select('id')
          .single();
        
        if (data) setProductAssociationId(data.id);
      }
      toast.success("Templates salvos para este produto!");
    } catch (error) {
      console.error('Erro ao salvar associação:', error);
      toast.error("Erro ao salvar associação");
    } finally {
      setSavingProductAssociation(false);
    }
  };

  // Funções para gerenciar múltiplas opções de honorários iniciais
  const adicionarOpcaoInicial = () => {
    setInitialFeeOptions(prev => [...prev, {
      id: crypto.randomUUID(),
      tipoHonorarios: "avista",
      valorTotal: "",
      numeroParcelas: "",
      valorParcela: "",
      temEntrada: false,
      valorEntrada: "",
      formasPagamentoEntrada: ["pix"],
      formasPagamentoParcelas: ["boleto"],
      formasPagamento: ["pix"],
      dataVencimento: "",
    }]);
  };

  const removerOpcaoInicial = (id: string) => {
    if (initialFeeOptions.length === 1) {
      toast.error("Deve haver pelo menos uma opção de honorários iniciais");
      return;
    }
    setInitialFeeOptions(prev => prev.filter(o => o.id !== id));
  };

  const atualizarOpcaoInicial = (id: string, field: keyof InitialFeeOption, value: any) => {
    setInitialFeeOptions(prev => prev.map(o => 
      o.id === id ? { ...o, [field]: value } : o
    ));
  };

  // Carregar rascunho existente
  const carregarRascunho = async () => {
    if (!rascunhoExistente) return;
    
    setCarregandoRascunho(true);
    try {
      const { data, error } = await supabase
        .from('contract_drafts')
        .select('*')
        .eq('id', rascunhoExistente)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setContraPartida(data.contra_partida || "");
        setObjetoContrato(data.objeto_contrato || "");
        setClausulaPrimeiraGerada(data.clausula_primeira_gerada || "");
        // Carregar primeira opção inicial
        if (initialFeeOptions.length > 0) {
          const firstOption = initialFeeOptions[0];
          atualizarOpcaoInicial(firstOption.id, 'tipoHonorarios', (data.tipo_honorarios as "avista" | "parcelado") || "avista");
          atualizarOpcaoInicial(firstOption.id, 'valorTotal', data.valor_total || "");
          atualizarOpcaoInicial(firstOption.id, 'numeroParcelas', data.numero_parcelas || "");
          atualizarOpcaoInicial(firstOption.id, 'valorParcela', data.valor_parcela || "");
          atualizarOpcaoInicial(firstOption.id, 'temEntrada', data.tem_entrada || false);
          atualizarOpcaoInicial(firstOption.id, 'valorEntrada', data.valor_entrada || "");
          atualizarOpcaoInicial(firstOption.id, 'formasPagamento', data.forma_pagamento ? data.forma_pagamento.split(',') : ["pix"]);
          atualizarOpcaoInicial(firstOption.id, 'dataVencimento', data.data_vencimento || "");
        }
        setTemHonorariosExito(data.tem_honorarios_exito || false);
        if (data.descricao_honorarios_exito || data.clausula_exito_gerada) {
          setExitoOptions([{
            id: crypto.randomUUID(),
            descricao: data.descricao_honorarios_exito || "",
            clausulaGerada: data.clausula_exito_gerada || "",
            gerando: false
          }]);
        }
        setContractPreviewText(data.contract_preview_text || "");
        
        toast.success("Rascunho carregado com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao carregar rascunho:', error);
      toast.error("Erro ao carregar rascunho");
    } finally {
      setCarregandoRascunho(false);
    }
  };

  // Salvar rascunho
  const salvarRascunho = async () => {
    if (!client || !user) {
      toast.error("Erro: cliente ou usuário não identificado");
      return;
    }
    
    setSalvandoRascunho(true);
    try {
      const firstOption = initialFeeOptions[0];
      const draftData = {
        user_id: user.id,
        client_id: client.id,
        client_name: client.nomeCompleto,
        product_name: productName,
        qualification: qualification,
        contra_partida: contraPartida,
        objeto_contrato: objetoContrato,
        clausula_primeira_gerada: clausulaPrimeiraGerada,
        tipo_honorarios: firstOption?.tipoHonorarios || "avista",
        valor_total: firstOption?.valorTotal || "",
        numero_parcelas: firstOption?.numeroParcelas || "",
        valor_parcela: firstOption?.valorParcela || "",
        tem_entrada: firstOption?.temEntrada || false,
        valor_entrada: firstOption?.valorEntrada || "",
        forma_pagamento: firstOption?.formasPagamento.join(',') || "pix",
        data_vencimento: firstOption?.dataVencimento || "",
        tem_honorarios_exito: temHonorariosExito,
        descricao_honorarios_exito: exitoOptions.map(o => o.descricao).join(' | '),
        clausula_exito_gerada: exitoOptions.map(o => o.clausulaGerada).join('\n\n'),
        contract_preview_text: contractPreviewText,
      };

      if (rascunhoExistente) {
        const { error } = await supabase
          .from('contract_drafts')
          .update(draftData)
          .eq('id', rascunhoExistente);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contract_drafts')
          .insert(draftData)
          .select('id')
          .single();
        
        if (error) throw error;
        if (data) setRascunhoExistente(data.id);
      }
      
      toast.success("Rascunho salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      toast.error("Erro ao salvar rascunho");
    } finally {
      setSalvandoRascunho(false);
    }
  };

  // Deletar rascunho
  const deletarRascunho = async () => {
    if (!rascunhoExistente) return;
    
    setDeletandoRascunho(true);
    try {
      const { error } = await supabase
        .from('contract_drafts')
        .delete()
        .eq('id', rascunhoExistente);
      
      if (error) throw error;
      
      setRascunhoExistente(null);
      toast.success("Rascunho excluído");
    } catch (error) {
      console.error('Erro ao deletar rascunho:', error);
      toast.error("Erro ao excluir rascunho");
    } finally {
      setDeletandoRascunho(false);
    }
  };

  // Salvar template de honorários êxito (geral - acessível a todos)
  const salvarTemplate = async () => {
    const primeiraOpcao = exitoOptions[0];
    if (!templateName.trim() || !primeiraOpcao.descricao.trim() || !user) {
      toast.error("Preencha o nome do template e a descrição");
      return;
    }

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('success_fee_templates')
        .insert({
          user_id: null,
          is_default: true,
          name: templateName.trim(),
          description: primeiraOpcao.descricao.trim(),
        });

      if (error) throw error;

      const { data } = await supabase
        .from('success_fee_templates')
        .select('id, name, description, is_default')
        .eq('is_default', true)
        .order('name');
      
      setTemplates(data || []);
      setTemplateName("");
      setShowSaveTemplate(false);
      setShowCreateDefaultExitoTemplate(false);
      toast.success("Template geral salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Criar template padrão de êxito (apenas admin)
  const criarTemplatePadraoExito = async () => {
    const primeiraOpcao = exitoOptions[0];
    if (!templateName.trim() || !primeiraOpcao.descricao.trim() || !user || !isAdmin) {
      toast.error("Preencha o nome do template e a descrição");
      return;
    }

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('success_fee_templates')
        .insert({
          user_id: null,
          is_default: true,
          name: templateName.trim(),
          description: primeiraOpcao.descricao.trim(),
        });

      if (error) throw error;

      const { data } = await supabase
        .from('success_fee_templates')
        .select('id, name, description, is_default')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .order('is_default', { ascending: false })
        .order('name');
      
      setTemplates(data || []);
      setTemplateName("");
      setShowCreateDefaultExitoTemplate(false);
      toast.success("Template padrão criado com sucesso!");
    } catch (error) {
      console.error('Erro ao criar template padrão:', error);
      toast.error("Erro ao criar template padrão");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Carregar template de êxito selecionado
  const carregarTemplate = (template: SimpleTemplate) => {
    setExitoOptions(prev => {
      const updated = [...prev];
      updated[0] = { ...updated[0], descricao: template.description, clausulaGerada: "" };
      return updated;
    });
    toast.success(`Template "${template.name}" carregado`);
  };

  // Deletar template de êxito
  const deletarTemplate = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('success_fee_templates')
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

  // Adicionar nova opção de êxito
  const adicionarOpcaoExito = () => {
    setExitoOptions(prev => [...prev, { id: crypto.randomUUID(), descricao: "", clausulaGerada: "", gerando: false }]);
  };

  // Remover opção de êxito
  const removerOpcaoExito = (id: string) => {
    if (exitoOptions.length === 1) {
      toast.error("Deve haver pelo menos uma opção de honorários êxito");
      return;
    }
    setExitoOptions(prev => prev.filter(o => o.id !== id));
  };

  // Atualizar descrição de uma opção
  const atualizarDescricaoExito = (id: string, descricao: string) => {
    setExitoOptions(prev => prev.map(o => o.id === id ? { ...o, descricao } : o));
  };

  // Atualizar cláusula gerada de uma opção
  const atualizarClausulaExito = (id: string, clausulaGerada: string) => {
    setExitoOptions(prev => prev.map(o => o.id === id ? { ...o, clausulaGerada } : o));
  };

  // Salvar template de honorários iniciais
  const salvarTemplateInicial = async () => {
    if (!initialTemplateName.trim() || !user) {
      toast.error("Preencha o nome do template");
      return;
    }

    const firstOption = initialFeeOptions[0];
    if (!firstOption) return;

    setSavingInitialTemplate(true);
    try {
      const { error } = await supabase
        .from('initial_fee_templates')
        .insert({
          user_id: user.id,
          name: initialTemplateName.trim(),
          descricao: initialTemplateDescricao.trim() || null,
          tipo_honorarios: firstOption.tipoHonorarios,
          valor_total: firstOption.valorTotal || null,
          numero_parcelas: firstOption.numeroParcelas || null,
          valor_parcela: firstOption.valorParcela || null,
          tem_entrada: firstOption.temEntrada,
          valor_entrada: firstOption.valorEntrada || null,
          forma_pagamento: firstOption.formasPagamento.join(','),
          forma_pagamento_entrada: firstOption.temEntrada ? firstOption.formasPagamentoEntrada.join(',') : null,
          forma_pagamento_parcelas: firstOption.tipoHonorarios === 'parcelado' ? firstOption.formasPagamentoParcelas.join(',') : null,
        });

      if (error) throw error;

      const { data } = await supabase
        .from('initial_fee_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      
      setInitialFeeTemplates(data || []);
      setInitialTemplateName("");
      setInitialTemplateDescricao("");
      setShowSaveInitialTemplate(false);
      toast.success("Template de honorários iniciais salvo!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingInitialTemplate(false);
    }
  };

  // Criar template geral de honorários iniciais (acessível a todos)
  const criarTemplatePadrao = async () => {
    if (!initialTemplateName.trim() || !user) {
      toast.error("Preencha o nome do template");
      return;
    }

    const firstOption = initialFeeOptions[0];
    if (!firstOption) return;

    setSavingInitialTemplate(true);
    try {
      const { error } = await supabase
        .from('initial_fee_templates')
        .insert({
          user_id: null,
          is_default: true,
          name: initialTemplateName.trim(),
          descricao: initialTemplateDescricao.trim() || null,
          tipo_honorarios: firstOption.tipoHonorarios,
          valor_total: firstOption.valorTotal || null,
          numero_parcelas: firstOption.numeroParcelas || null,
          valor_parcela: firstOption.valorParcela || null,
          tem_entrada: firstOption.temEntrada,
          valor_entrada: firstOption.valorEntrada || null,
          forma_pagamento: firstOption.formasPagamento.join(','),
          forma_pagamento_entrada: firstOption.temEntrada ? firstOption.formasPagamentoEntrada.join(',') : null,
          forma_pagamento_parcelas: firstOption.tipoHonorarios === 'parcelado' ? firstOption.formasPagamentoParcelas.join(',') : null,
        });

      if (error) throw error;

      const { data } = await supabase
        .from('initial_fee_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      
      setInitialFeeTemplates(data || []);
      setInitialTemplateName("");
      setInitialTemplateDescricao("");
      setShowCreateDefaultTemplate(false);
      setShowSaveInitialTemplate(false);
      toast.success("Template geral criado com sucesso!");
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast.error("Erro ao criar template");
    } finally {
      setSavingInitialTemplate(false);
    }
  };

  // Carregar template de honorários iniciais na primeira opção
  const carregarTemplateInicial = (template: InitialFeeTemplate) => {
    if (initialFeeOptions.length === 0) return;
    const firstId = initialFeeOptions[0].id;
    
    atualizarOpcaoInicial(firstId, 'tipoHonorarios', (template.tipo_honorarios as "avista" | "parcelado") || "avista");
    if (template.valor_total) atualizarOpcaoInicial(firstId, 'valorTotal', template.valor_total);
    if (template.numero_parcelas) atualizarOpcaoInicial(firstId, 'numeroParcelas', template.numero_parcelas);
    if (template.valor_parcela) atualizarOpcaoInicial(firstId, 'valorParcela', template.valor_parcela);
    atualizarOpcaoInicial(firstId, 'temEntrada', template.tem_entrada || false);
    if (template.valor_entrada) atualizarOpcaoInicial(firstId, 'valorEntrada', template.valor_entrada);
    atualizarOpcaoInicial(firstId, 'formasPagamento', template.forma_pagamento ? template.forma_pagamento.split(',') : ["pix"]);
    if (template.forma_pagamento_entrada) {
      atualizarOpcaoInicial(firstId, 'formasPagamentoEntrada', template.forma_pagamento_entrada.split(','));
    }
    if (template.forma_pagamento_parcelas) {
      atualizarOpcaoInicial(firstId, 'formasPagamentoParcelas', template.forma_pagamento_parcelas.split(','));
    }
    toast.success(`Template "${template.name}" carregado`);
  };

  // Deletar template de honorários iniciais
  const deletarTemplateInicial = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('initial_fee_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      setInitialFeeTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template excluído");
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      toast.error("Erro ao excluir template");
    }
  };

  // Gerar cláusula primeira com IA
  const gerarClausulaPrimeira = async () => {
    if (!contraPartida.trim() || !objetoContrato.trim()) {
      toast.error("Preencha a parte contrária e o objeto do contrato");
      return;
    }

    setGerandoClausulaPrimeira(true);
    try {
      const prompt = `Você é um advogado especialista em contratos de prestação de serviços advocatícios. 
      
Reescreva a cláusula primeira de um contrato de honorários advocatícios de forma jurídica e profissional.

O modelo original é:
"Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante, em face do …………………, a ………………………………….."

Com base nas informações fornecidas:
- Parte contrária (em face de): ${contraPartida}
- Objeto do contrato (o que será requerido): ${objetoContrato}

Reescreva a frase de forma completa e juridicamente correta, substituindo os campos em branco. A frase deve começar com "Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante,".

Retorne APENAS a frase da cláusula primeira reescrita, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'gemini-flash'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        setClausulaPrimeiraGerada(response.trim());
        toast.success("Cláusula primeira gerada com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar cláusula primeira:', error);
      toast.error("Erro ao gerar cláusula. Tente novamente.");
    } finally {
      setGerandoClausulaPrimeira(false);
    }
  };

  // Gerar cláusula de honorários êxito com IA para uma opção específica
  const gerarClausulaExitoParaOpcao = async (opcaoId: string) => {
    const opcao = exitoOptions.find(o => o.id === opcaoId);
    if (!opcao || !opcao.descricao.trim()) {
      toast.error("Descreva os honorários de êxito");
      return;
    }

    setExitoOptions(prev => prev.map(o => o.id === opcaoId ? { ...o, gerando: true } : o));
    
    try {
      const prompt = `Você é um advogado especialista em contratos de prestação de serviços advocatícios.

Gere uma cláusula de honorários de êxito para um contrato de prestação de serviços advocatícios.

Contexto do contrato:
- Parte contrária: ${contraPartida || 'Não informada'}
- Objeto do contrato: ${objetoContrato || 'Não informado'}

Descrição dos honorários de êxito informada pelo usuário:
${opcao.descricao}

Com base no objeto do contrato e na descrição dos honorários de êxito, redija uma cláusula jurídica clara e profissional que indique:
1. A condição de êxito (relacionada ao objeto do contrato)
2. O valor ou percentual devido
3. Eventuais condições de pagamento

REGRAS IMPORTANTES:
- NÃO inicie com letras como "a)" ou "b)". Escreva apenas o texto da cláusula de forma direta.
- NÃO inclua títulos ou cabeçalhos como "Cláusula Terceira", "CLÁUSULA TERCEIRA - DOS HONORÁRIOS DE ÊXITO" ou similares.
- NÃO inclua o texto introdutório "Em remuneração pelos serviços profissionais ora contratados serão devidos honorários advocatícios da seguinte forma:".
- Comece diretamente com o texto da cláusula (ex: "Em caso de procedência da ação..." ou "O(a) CONTRATANTE pagará...").

Retorne APENAS o texto da cláusula reescrita, sem explicações adicionais e sem cabeçalhos.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'gemini-flash'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        // Limpar resposta: remover letras iniciais, cabeçalhos e texto introdutório
        let clausulaLimpa = response.trim()
          .replace(/^[a-z]\)\s*/i, '') // Remove letras como "a)" ou "b)"
          .replace(/^(Cláusula Terceira|CLÁUSULA TERCEIRA)[^\n]*\n*/gi, '') // Remove cabeçalho "Cláusula Terceira" e variações
          .replace(/^CLÁUSULA TERCEIRA\s*[–-]\s*DOS HONORÁRIOS DE ÊXITO\s*\n*/gi, '') // Remove cabeçalho com subtítulo
          .replace(/^Em remuneração pelos serviços profissionais ora contratados serão devidos honorários advocatícios da seguinte forma:\s*/gi, '') // Remove texto introdutório
          .trim();
        setExitoOptions(prev => prev.map(o => o.id === opcaoId ? { ...o, clausulaGerada: clausulaLimpa, gerando: false } : o));
        toast.success("Cláusula de honorários êxito gerada com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar cláusula de êxito:', error);
      toast.error("Erro ao gerar cláusula. Tente novamente.");
      setExitoOptions(prev => prev.map(o => o.id === opcaoId ? { ...o, gerando: false } : o));
    }
  };

  // Formatar valor em extenso
  const valorPorExtenso = (valor: string): string => {
    const num = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(num)) return '';
    
    return `(${new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(num).replace('R$', '').trim()} reais)`;
  };

  // Gerar cláusula terceira (honorários)
  const gerarClausulaTerceira = (): string => {
    const clausulasExitoGeradas = exitoOptions.filter(o => o.clausulaGerada.trim());
    const temClausulasExito = temHonorariosExito && clausulasExitoGeradas.length > 0;
    
    // Contar total de opções de pagamento para determinar se usa letras
    const totalOpcoes = (temHonorariosIniciais ? initialFeeOptions.length : 0) + (temClausulasExito ? clausulasExitoGeradas.length : 0);
    const usarLetras = totalOpcoes > 1;
    
    let letraAtual = 0;
    const todasClausulas: string[] = [];
    
    // Adicionar honorários iniciais (todas as opções)
    if (temHonorariosIniciais) {
      initialFeeOptions.forEach((opcao) => {
        const valorFormatado = parseFloat(opcao.valorTotal.replace(/\./g, '').replace(',', '.') || '0');
        const valorExtenso = valorPorExtenso(opcao.valorTotal);
        const prefixo = usarLetras ? `${String.fromCharCode(97 + letraAtual)}) ` : '';
        letraAtual++;
        
        let textoHonorariosIniciais = '';
        
        if (opcao.tipoHonorarios === 'avista') {
          const formaPagamentoTexto = formatarFormasPagamento(opcao.formasPagamento);
          textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} à vista que serão pagos ${formaPagamentoTexto} até o dia ${opcao.dataVencimento || '[DATA]'} para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
        } else {
          const numParcelas = parseInt(opcao.numeroParcelas) || 0;
          const valorParcelaNum = parseFloat(opcao.valorParcela.replace(/\./g, '').replace(',', '.') || '0');
          const valorEntradaNum = parseFloat(opcao.valorEntrada.replace(/\./g, '').replace(',', '.') || '0');
          
          if (opcao.temEntrada && valorEntradaNum > 0) {
            const formaPagamentoEntradaTexto = formatarFormasPagamento(opcao.formasPagamentoEntrada);
            const formaPagamentoParcelasTexto = formatarFormasPagamento(opcao.formasPagamentoParcelas);
            textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} parcelados, sendo R$${new Intl.NumberFormat('pt-BR').format(valorEntradaNum)} de entrada ${formaPagamentoEntradaTexto} e mais ${numParcelas} parcelas de R$${new Intl.NumberFormat('pt-BR').format(valorParcelaNum)} cada ${formaPagamentoParcelasTexto}, com vencimento para o dia ${opcao.dataVencimento || '[DATA]'} de cada mês, para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
          } else {
            const formaPagamentoTexto = formatarFormasPagamento(opcao.formasPagamentoParcelas);
            textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} parcelados em ${numParcelas} parcelas de R$${new Intl.NumberFormat('pt-BR').format(valorParcelaNum)} cada, ${formaPagamentoTexto}, com vencimento para o dia ${opcao.dataVencimento || '[DATA]'} de cada mês, para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
          }
        }
        
        todasClausulas.push(textoHonorariosIniciais);
      });
    }
    
    // Adicionar cada cláusula de êxito com sua própria letra
    if (temClausulasExito) {
      clausulasExitoGeradas.forEach((opcao) => {
        const prefixo = usarLetras ? `${String.fromCharCode(97 + letraAtual)}) ` : '';
        letraAtual++;
        todasClausulas.push(`${prefixo}${opcao.clausulaGerada}`);
      });
    }
    
    if (todasClausulas.length === 0) {
      return `Em remuneração pelos serviços profissionais ora contratados serão devidos honorários advocatícios da seguinte forma:\n\n[Honorários não definidos]`;
    }
    
    return `Em remuneração pelos serviços profissionais ora contratados serão devidos honorários advocatícios da seguinte forma:\n\n${todasClausulas.join('\n\n')}`;
  };

  // Verificar se é contrato BSB
  const isContratoBSB = (): boolean => {
    return productName.toLowerCase().includes('processos bsb') || 
           productName.toLowerCase().includes('processos de bsb') ||
           productName.toLowerCase() === 'bsb';
  };

  // Gerar texto do contrato BSB (modelo específico)
  const gerarTextoContratoBSB = (): string => {
    if (!client) return "";
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const clausulaTerceira = gerarClausulaTerceira();
    
    let texto = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS\n\n`;
    
    // Cabeçalho com múltiplos contratados (específico BSB)
    texto += `que entre si fazem, de um lado, como contratados, o escritório NAVES E MAC CORD ADVOGADOS, inscrito no CNPJ sob o número 52.041.973/0001-72, neste ato representado por seu sócio Guilherme Menezes Naves, OAB/DF 16.826, com escritório no endereço SHIS QI 19 Conjunto 4, Casa 10, Lago Sul, Brasília/DF, CEP 71.655-040; EGG NUNES ADVOGADOS ASSOCIADOS, inscrito no CNPJ sob o número 10.378.694/0001-59, neste ato representado por seu sócio Marcos Luiz Egg Nunes, OAB/MG 115.283, com escritório à Rua São Paulo nº 1104, 9º andar, Belo Horizonte/MG; o advogado RAFAEL EGG NUNES, OAB/MG 118.395, com mesmo endereço do escritório Egg Nunes Advogados Associados; e MARINHO E JANUÁRIO SOCIEDADE DE ADVOGADOS, inscrito no CNPJ sob o número 50.127.848/0001-54, neste ato representado por sua sócia Gabriela Almeida Marinho, OAB/MG 112.300, com escritório à Av. Augusto de Lima, nº. 655, Conj. 1209, Belo Horizonte/MG; e de outro lado, como cliente, ora contratante, ${qualification} ajustam, entre si, com fulcro no artigo 22 da Lei nº 8.906/94, mediante as seguintes cláusulas e condições, contrato de honorários advocatícios.\n\n`;
    
    // Cláusula Primeira - Fixa para BSB
    texto += `Cláusula Primeira\n\n`;
    texto += `Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante o reajuste dos seus vencimentos visando a correção de disparidade de tratamento e aplicação da isonomia em relação aos servidores da carreira estruturada do FNDE.\n\n`;
    
    // Cláusula Segunda
    texto += `Cláusula Segunda\n\n`;
    texto += `O(a) Contratante, que reconhece já haver recebido a orientação preventiva comportamental e jurídica para a consecução dos serviços, inclusive dos riscos sobre êxito na causa, fornecerá aos Contratados os documentos e meios necessários à comprovação processual do seu pretendido direito.\n\n`;
    
    // Cláusula Terceira - Honorários
    texto += `Cláusula Terceira\n\n`;
    texto += `${clausulaTerceira}\n\n`;
    
    // Parágrafos específicos BSB
    const paragrafosBSB = [
      'Parágrafo Primeiro - Na hipótese do(a) Contratante fazer acordo com a parte "ex-adversa", com ou sem o concurso do advogado, ou na hipótese de ser cassada a procuração outorgada (a qualquer tempo), e ainda caso não prossiga a ação por motivo que independa da vontade dos Contratados, os valores referentes aos honorários continuarão devidos.',
      'Parágrafo Segundo - Caso o(a) Contratante queira sustentação oral em seu favor em instâncias superiores, o que é opcional em um processo, pagará o valor constante na tabela de honorários mínimos da OAB/MG vigente à época.',
      'Parágrafo Terceiro - O não pagamento dos honorários poderá implicar na revogação dos poderes, além do acréscimo de multa de 20% sobre o total devido.',
      'Parágrafo Quarto - O(a) Contratante autoriza, caso seja necessário, penhora em contracheque de salário/pensão em caso de não pagamento dos honorários.',
      'Parágrafo Quinto - Caso o(a) Contratante opte por pagamento via boleto bancário, fica ciente que cada boleto terá o acréscimo de R$4,00 referente à taxas bancárias.',
      `Parágrafo Sexto - O(a) Contratante declara estar ciente que poderá receber citação/intimação judicial através do número de telefone ${client.telefone || '[TELEFONE]'}.`
    ];
    
    paragrafosBSB.forEach(p => {
      texto += `${p}\n\n`;
    });
    
    // Demais cláusulas específicas BSB
    texto += `Cláusula Quarta\n\n`;
    texto += `Caso o(a) Contratante opte pelo trâmite processual na justiça comum e não no Juizado Especial (que tem isenção de custas para ações com pedido de até 60 salários mínimos), pagará ainda as custas e despesas judiciais do Tribunal, além de quaisquer outras que decorrerem do serviço, mediante apresentação de demonstrativos analíticos pelos Contratados (caso haja referidas despesas e também não esteja sob justiça gratuita).\n\n`;
    
    texto += `Cláusula Quinta\n\n`;
    texto += `O presente contrato pode ser executado pelos Contratados em conjunto ou separadamente por apenas um dos Contratados.\n\n`;
    
    texto += `Cláusula Sexta\n\n`;
    texto += `O(a) Contratante fica ciente que os únicos canais de comunicação oficial dos Contratados são os números de telefone/WhatsApp 61-99996-2274; 31-32268742; e 31-98397-0212; sendo que os Contratados não se responsabilizam por contatos feitos por outros números desconhecidos.\n\n`;
    
    texto += `Cláusula Sétima\n\n`;
    texto += `O(a) Contratante fica ciente que as informações do processo são públicas, exceto os processos em segredo de justiça, e que o Contratado não tem controle sobre elas, sendo a veiculação feita pelo respectivo Tribunal.\n\n`;
    
    texto += `Cláusula Oitava\n\n`;
    texto += `Elegem as partes o foro da Comarca de domicílio do(a) Contratante para dirimir dúvidas sobre este contrato, podendo ainda os Contratados, em caso de execução do contrato, optar pelo seus foros de domicílio.\n\n`;
    
    texto += `E por estarem assim justos e contratados, assinam na presença de duas testemunhas para que passe a produzir todos os seus efeitos legais.\n\n`;
    texto += `Brasília/DF, ${dataAtual}.\n\n\n`;
    
    // Bloco de assinaturas específico BSB (4 contratados)
    texto += `_____________________________________\n`;
    texto += `Contratado: NAVES E MAC CORD ADVOGADOS\n`;
    texto += `Neste ato representado por seu sócio Guilherme Menezes Naves, OAB/DF 16.826\n\n`;
    
    texto += `_____________________________________\n`;
    texto += `Contratado: EGG NUNES ADVOGADOS ASSOCIADOS\n`;
    texto += `Neste ato representado por seu sócio Marcos Luiz Egg Nunes, OAB/MG 115.283\n\n`;
    
    texto += `_____________________________________\n`;
    texto += `Contratado: MARINHO E JANUÁRIO SOCIEDADE DE ADVOGADOS\n`;
    texto += `Neste ato representado por sua sócia Gabriela Almeida Marinho, OAB/MG 112.300\n\n`;
    
    texto += `_______________________________________\n`;
    texto += `Contratado: Rafael Egg Nunes, OAB/MG 118.395\n\n`;
    
    texto += `________________________________________\n`;
    texto += `Contratante: ${client.nomeCompleto.toUpperCase()}\n\n`;
    
    texto += `Testemunhas:\n\n`;
    texto += `1ª) ______________________________\n\n`;
    texto += `2ª) _____________________________\n`;

    return texto;
  };

  // Gerar texto completo do contrato para preview (modelo padrão)
  const gerarTextoContrato = (): string => {
    if (!client) return "";
    
    // Se for contrato BSB, usar modelo específico
    if (isContratoBSB()) {
      return gerarTextoContratoBSB();
    }
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const clausulaTerceira = gerarClausulaTerceira();
    
    let texto = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS\n\n`;
    texto += `que entre si fazem, de um lado, como contratados, o escritório **EGG NUNES ADVOGADOS ASSOCIADOS**, inscrito no CNPJ sob o número 10.378.694/0001-59, neste ato representado por seu sócio **Marcos Luiz Egg Nunes**, OAB/MG 115.283, com escritório à Rua São Paulo nº 1104 / 9º andar – Belo Horizonte/MG, e o advogado **RAFAEL EGG NUNES**, OAB/MG 118.395, também com endereço à Rua São Paulo nº 1104 / 9º andar – Belo Horizonte/MG; e de outro lado, como cliente, ora contratante, **${client.nomeCompleto.toUpperCase()}**, ${qualification.replace(client.nomeCompleto, '').replace(/^,\s*/, '')}, ajustam, entre si, com fulcro no artigo 22 da Lei nº 8.906/94, mediante as seguintes cláusulas e condições, contrato de honorários advocatícios.\n\n`;
    
    texto += `Cláusula Primeira\n\n`;
    texto += `${clausulaPrimeiraGerada || 'Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante, em face do …………………, a ………………………………..'}\n\n`;
    texto += `Parágrafo Único - A atuação compreende o processo de forma completa, inclusive eventuais e cabíveis fases recursais.\n\n`;
    
    texto += `Cláusula Segunda\n\n`;
    texto += `O(a) Contratante, que reconhece já haver recebido a orientação preventiva comportamental e jurídica para a consecução dos serviços, inclusive dos riscos sobre êxito na causa, fornecerá aos Contratados os documentos e meios necessários à comprovação processual do seu pretendido direito.\n\n`;
    
    texto += `Cláusula Terceira\n\n`;
    texto += `${clausulaTerceira}\n\n`;
    
    texto += `Parágrafo Primeiro - Na hipótese do(a) Contratante fazer acordo com a parte "ex-adversa", com ou sem o concurso do advogado, ou na hipótese de ser cassada a procuração outorgada (a qualquer tempo), e ainda caso não prossiga a ação por motivo que independa da vontade dos Contratados, os valores referentes aos honorários continuarão devidos.\n\n`;
    texto += `Parágrafo Segundo – Caso o(a) Contratante queira sustentação oral em seu favor em instâncias superiores, o que é opcional em um processo, pagará o valor constante na tabela de honorários mínimos da OAB/MG vigente à época.\n\n`;
    texto += `Parágrafo Terceiro - O não pagamento de qualquer prestação, caso haja parcelamento dos honorários, implicará na revogação dos poderes, além do acréscimo de multa de 20% sobre o devido para o caso da necessidade de cobrança judicial.\n\n`;
    texto += `Parágrafo Quarto – O atraso no pagamento de qualquer parcela, caso tenha optado pelo pagamento parcelado, acarretará o vencimento antecipado das demais - que poderão ser cobradas judicialmente.\n\n`;
    texto += `Parágrafo Quinto – Ficam os herdeiros do(a) Contratante comprometidos também ao pagamento dos valores acordados neste contrato em eventual ausência do(a) Contratante quando do recebimento.\n\n`;
    texto += `Parágrafo Sexto - O(a) Contratante autoriza, caso seja necessário, penhora em contracheque de salário/pensão em caso de não pagamento dos honorários.\n\n`;
    texto += `Parágrafo Sétimo – Caso o(a) Contratante tenha optado por pagamento via boleto bancário, fica ciente que cada boleto terá o acréscimo de R$4,00 referente à taxas bancárias.\n\n`;
    texto += `Parágrafo Oitavo – Na hipótese de desistência pelo(a) Contratante após assinatura deste contrato, e antes do ingresso da ação, serão devidos honorários de R$500,00 (quinhentos reais) a título de consultoria prestada.\n\n`;
    texto += `Parágrafo Nono - O(a) Contratante declara estar ciente que poderá receber citação/intimação judicial através do número de telefone ${client.telefone || '[telefone do cliente]'}.\n\n`;
    
    texto += `Cláusula Quarta\n\n`;
    texto += `Os honorários de condenação (sucumbência), se houver, pertencerão aos Contratados, sem exclusão dos que ora são combinados, em conformidade com os artigos 23 da Lei nº 8.906/94 e 35, parágrafo 1º, do Código de Ética e Disciplina da Ordem dos Advogados do Brasil.\n\n`;
    
    texto += `Cláusula Quinta\n\n`;
    texto += `O(a) Contratante pagará ainda as custas e despesas judiciais, além de quaisquer outras que decorrerem do serviço, mediante apresentação de demonstrativos analíticos pelos Contratados (caso haja referidas despesas).\n\n`;
    
    texto += `Cláusula Sexta\n\n`;
    texto += `O(a) Contratante obriga-se a informar aos Contratados qualquer mudança de endereço residencial e/ou comercial, telefone residencial, comercial ou celular e endereço eletrônico (e-mail), sob pena de se dar por válida a intimação/comunicação realizada pelos advogados ao endereço residencial e/ou eletrônico constante deste contrato, que é expressamente aceito como domicílio do(a) Contratante.\n\n`;
    
    texto += `Cláusula Sétima\n\n`;
    texto += `Eleito para o presente contrato, para dirimir dúvidas e/ou pendências dele decorrentes, o foro da comarca de Belo Horizonte-MG, renunciando as partes a qualquer outro, por mais privilegiado que seja.\n\n`;
    
    texto += `E por estarem assim justos e contratados, assinam o presente instrumento, em duas vias de igual teor e forma, juntamente com duas testemunhas.\n\n`;
    texto += `Belo Horizonte, ${dataAtual}.\n\n\n`;
    texto += `[ASSINATURA_CONTRATADO_1]\n`;
    texto += `<<<<assinatura_contratado1>>>>\n`;
    texto += `_______________________________________\n`;
    texto += `**EGG NUNES ADVOGADOS ASSOCIADOS**\n`;
    texto += `Representado pelo sócio Marcos Luiz Egg Nunes, OAB/MG 115.283\n`;
    texto += `CONTRATADO\n\n\n`;
    texto += `[ASSINATURA_CONTRATADO_2]\n`;
    texto += `<<<<assinatura_contratado2>>>>\n`;
    texto += `_______________________________________\n`;
    texto += `**RAFAEL EGG NUNES**, OAB/MG 118.395\n`;
    texto += `CONTRATADO\n\n\n`;
    texto += `[ASSINATURA_CONTRATANTE]\n`;
    texto += `<<<<assinatura_contratante>>>>\n`;
    texto += `_______________________________________\n`;
    texto += `**${client.nomeCompleto.toUpperCase()}**\n`;
    texto += `CONTRATANTE\n\n\n`;
    texto += `[TESTEMUNHAS_LADO_A_LADO]\n`;
    texto += `TESTEMUNHAS:\n`;
    texto += `<<<<assinatura_testemunha1>>>>\n`;
    texto += `<<<<assinatura_testemunha2>>>>\n`;

    return texto;
  };

  // Abrir pré-visualização
  const abrirPreview = () => {
    const firstOption = initialFeeOptions[0];
    
    // Para contratos BSB, não precisa da cláusula primeira gerada (é fixa)
    const precisaClausulaPrimeira = !isContratoBSB();
    
    if (precisaClausulaPrimeira && !clausulaPrimeiraGerada) {
      toast.error("Crie a Cláusula Primeira (use o botão 'Usar Texto Manual' ou 'Gerar com IA')");
      return;
    }
    
    if (temHonorariosIniciais && (!firstOption?.valorTotal || !firstOption?.dataVencimento)) {
      toast.error("Preencha todos os campos obrigatórios dos honorários");
      return;
    }

    // Verificar se tem pelo menos uma cláusula de êxito gerada se êxito está ativado
    if (temHonorariosExito) {
      const clausulasExitoGeradas = exitoOptions.filter(o => o.clausulaGerada.trim());
      if (clausulasExitoGeradas.length === 0) {
        toast.error("Adicione pelo menos uma cláusula de êxito (use 'Usar Manual' ou 'Gerar com IA')");
        return;
      }
    }

    const texto = gerarTextoContrato();
    setContractPreviewText(texto);
    setShowPreview(true);
  };

  // Gerar contrato PDF conforme modelo oficial
  const gerarContratoPDF = async () => {
    if (!client) return;
    
    setGerandoContrato(true);
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
      const marginTop = 15;
      const marginBottom = 25;
      const contentWidth = pageWidth - marginLeft - marginRight;
      const lineHeight = 3.8;
      const paragraphSpacing = 1.5;
      
      let yPos = marginTop;
      let currentPage = 1;
      
      // Função para adicionar rodapé em cada página
      const addFooter = () => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('31 3226-8742 | escritorio@eggnunes.com.br | www.eggnunes.com.br', pageWidth / 2, pageHeight - 15, { align: 'center' });
        doc.text('Rua São Paulo, 1104 - 9º andar - Centro - Belo Horizonte - MG - 30170-131', pageWidth / 2, pageHeight - 10, { align: 'center' });
      };
      
      // Carregar logo uma vez
      let logoImg: HTMLImageElement | null = null;
      let logoWidth = 35;
      let logoHeight = 0;
      try {
        logoImg = new Image();
        logoImg.src = logoEggnunes;
        await new Promise((resolve, reject) => {
          logoImg!.onload = resolve;
          logoImg!.onerror = reject;
        });
        logoHeight = (logoImg.height / logoImg.width) * logoWidth;
      } catch (e) {
        console.warn('Não foi possível carregar a logo:', e);
        logoImg = null;
      }
      
      // Função para adicionar logo no topo da página
      const addHeader = () => {
        if (logoImg) {
          const logoX = (pageWidth - logoWidth) / 2;
          doc.addImage(logoImg, 'PNG', logoX, marginTop, logoWidth, logoHeight);
        }
      };
      
      // Função para verificar quebra de página (agora adiciona logo também)
      const checkPageBreak = (additionalHeight: number) => {
        if (yPos + additionalHeight > pageHeight - marginBottom) {
          addFooter();
          doc.addPage();
          currentPage++;
          yPos = marginTop;
          addHeader();
          yPos += logoHeight + 8;
        }
      };
      
      // Adicionar logo na primeira página
      addHeader();
      yPos += logoHeight + 8;
      
      // Processar texto do contrato
      const lines = contractPreviewText.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Título principal - centralizado e em negrito
        if (trimmedLine === 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS') {
          checkPageBreak(12);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          yPos += 10;
          continue;
        }
        
        // Cláusulas - negrito
        if (trimmedLine.match(/^Cláusula\s+(Primeira|Segunda|Terceira|Quarta|Quinta|Sexta|Sétima|Oitava|Nona|Décima)/i)) {
          checkPageBreak(8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(trimmedLine, marginLeft, yPos);
          yPos += lineHeight + 1;
          continue;
        }
        
        // Parágrafos - negrito no título
        if (trimmedLine.match(/^Parágrafo\s+(Primeiro|Segundo|Terceiro|Quarto|Quinto|Sexto|Sétimo|Oitavo|Único)/i)) {
          checkPageBreak(8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          const textLines = doc.splitTextToSize(trimmedLine, contentWidth);
          
          // Primeira linha em negrito, resto em normal para justificação
          doc.text(textLines, marginLeft, yPos, { align: 'justify', maxWidth: contentWidth });
          yPos += textLines.length * lineHeight + 1;
          continue;
        }
        
        // Marcadores de assinatura centralizada - Contratante
        if (trimmedLine === '[ASSINATURA_CONTRATANTE]') {
          continue; // Apenas marcador, não renderiza
        }
        
        // Marcadores de assinatura centralizada - Contratados
        if (trimmedLine === '[ASSINATURA_CONTRATADO_1]' || trimmedLine === '[ASSINATURA_CONTRATADO_2]') {
          continue; // Apenas marcador, não renderiza
        }
        
        // Marcador de testemunhas lado a lado
        if (trimmedLine === '[TESTEMUNHAS_LADO_A_LADO]') {
          continue; // Apenas marcador, não renderiza
        }
        
        // Textos âncora do ZapSign - renderizar em branco, 1pt (invisíveis no PDF impresso)
        if (trimmedLine.startsWith('<<<<') && trimmedLine.endsWith('>>>>')) {
          doc.setFontSize(1);
          doc.setTextColor(255, 255, 255); // Branco - invisível
          
          // Posicionar âncora de acordo com o tipo de signatário
          let anchorX = pageWidth / 2; // Padrão: centralizado (contratados e contratante)
          if (trimmedLine.includes('testemunha1')) {
            anchorX = marginLeft + 10; // Esquerda
          } else if (trimmedLine.includes('testemunha2')) {
            anchorX = pageWidth / 2 + 10; // Direita
          }
          
          doc.text(trimmedLine, anchorX, yPos);
          doc.setTextColor(0, 0, 0); // Restaurar preto
          doc.setFontSize(9);
          continue;
        }
        
        // Linhas de assinatura - centralizadas com espaço acima para assinatura
        if (trimmedLine.startsWith('_____')) {
          checkPageBreak(18);
          // Espaço para assinatura antes da linha
          yPos += 12;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight + 1;
          continue;
        }
        
        // Nomes em negrito cercados por ** - centralizado e em negrito
        if (trimmedLine.startsWith('**') && trimmedLine.includes('**')) {
          checkPageBreak(6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          // Remover os ** do texto
          const textoLimpo = trimmedLine.replace(/\*\*/g, '');
          doc.text(textoLimpo, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight + 1;
          continue;
        }
        
        // CONTRATANTE / CONTRATADO - centralizado
        if (trimmedLine === 'CONTRATANTE' || trimmedLine === 'CONTRATADO') {
          checkPageBreak(6);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight + 4;
          continue;
        }
        
        // Representado pelo sócio... - centralizado
        if (trimmedLine.startsWith('Representado pelo sócio')) {
          checkPageBreak(6);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight + 1;
          continue;
        }
        
        // Testemunhas - centralizado com as duas lado a lado (apenas assinatura)
        if (trimmedLine === 'TESTEMUNHAS:') {
          checkPageBreak(30);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight + 12;
          
          // Desenhar as duas testemunhas lado a lado (apenas linha de assinatura)
          const col1X = marginLeft + 10;
          const col2X = pageWidth / 2 + 10;
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          
          // Apenas linhas de assinatura das testemunhas
          doc.text('1. ________________________', col1X, yPos);
          doc.text('2. ________________________', col2X, yPos);
          yPos += lineHeight + 4;
          
          continue;
        }
        
        // CONTRATADOS (título centralizado)
        if (trimmedLine === 'CONTRATADOS') {
          checkPageBreak(8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          yPos += lineHeight + 2;
          continue;
        }
        
        // Linha vazia
        if (!trimmedLine) {
          yPos += paragraphSpacing;
          continue;
        }
        
        // Texto normal - verificar se contém partes em negrito **texto**
        if (trimmedLine.includes('**')) {
          // Processar linha com partes em negrito - renderizar com justificação manual
          doc.setFontSize(9);
          
          // Criar lista de palavras com informação de negrito (sem espaços separados)
          const words: { text: string; bold: boolean }[] = [];
          const partes = trimmedLine.split(/(\*\*[^*]+\*\*)/g).filter(p => p);
          
          for (const parte of partes) {
            if (parte.startsWith('**') && parte.endsWith('**')) {
              const textoNegrito = parte.replace(/\*\*/g, '');
              const palavras = textoNegrito.split(/\s+/).filter(p => p);
              for (const palavra of palavras) {
                words.push({ text: palavra, bold: true });
              }
            } else {
              const palavras = parte.split(/\s+/).filter(p => p);
              for (const palavra of palavras) {
                words.push({ text: palavra, bold: false });
              }
            }
          }
          
          // Agrupar palavras em linhas
          const lines: { text: string; bold: boolean }[][] = [];
          let currentLine: { text: string; bold: boolean }[] = [];
          let currentLineWidth = 0;
          const spaceWidth = doc.getTextWidth(' ');
          
          for (const word of words) {
            doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
            const wordWidth = doc.getTextWidth(word.text);
            const widthWithSpace = currentLineWidth > 0 ? spaceWidth + wordWidth : wordWidth;
            
            if (currentLineWidth + widthWithSpace > contentWidth && currentLine.length > 0) {
              lines.push(currentLine);
              currentLine = [word];
              doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
              currentLineWidth = doc.getTextWidth(word.text);
            } else {
              currentLine.push(word);
              currentLineWidth += widthWithSpace;
            }
          }
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          
          // Renderizar cada linha justificada
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const lineWords = lines[lineIdx];
            const isLastLine = lineIdx === lines.length - 1;
            
            // Calcular largura total das palavras
            let totalWordsWidth = 0;
            for (const word of lineWords) {
              doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
              totalWordsWidth += doc.getTextWidth(word.text);
            }
            
            // Calcular espaço entre palavras para justificar
            const totalSpaces = lineWords.length - 1;
            let justifiedSpaceWidth = spaceWidth;
            
            if (!isLastLine && totalSpaces > 0) {
              const remainingSpace = contentWidth - totalWordsWidth;
              justifiedSpaceWidth = remainingSpace / totalSpaces;
            }
            
            // Renderizar palavras
            let xPos = marginLeft;
            for (let i = 0; i < lineWords.length; i++) {
              const word = lineWords[i];
              doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
              doc.text(word.text, xPos, yPos);
              xPos += doc.getTextWidth(word.text);
              
              if (i < lineWords.length - 1) {
                xPos += justifiedSpaceWidth;
              }
            }
            
            yPos += lineHeight;
            checkPageBreak(lineHeight);
          }
          
          yPos += paragraphSpacing;
          continue;
        }
        
        // Texto normal simples - justificado
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const textLines = doc.splitTextToSize(trimmedLine, contentWidth);
        checkPageBreak(textLines.length * lineHeight + paragraphSpacing);
        doc.text(textLines, marginLeft, yPos, { align: 'justify', maxWidth: contentWidth });
        yPos += textLines.length * lineHeight + paragraphSpacing;
      }
      
      // Adicionar rodapé na última página
      addFooter();
      
      const nomeArquivo = `Contrato_${client.nomeCompleto.replace(/\s+/g, '_')}_${productName.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`;
      
      // Salvar PDF para possível upload no Teams e ZapSign
      const pdfOutput = doc.output('arraybuffer');
      const uint8Array = new Uint8Array(pdfOutput);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Content = btoa(binary);
      setPdfForTeams({ fileName: nomeArquivo, content: base64Content });
      
      // Salvar dados para ZapSign
      setPdfBase64ForZapSign(base64Content);
      setDocumentNameForZapSign(nomeArquivo.replace('.pdf', ''));
      
      // Salvar PDF na pasta do cliente no storage
      try {
        const clientFolder = client.nomeCompleto.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const filePath = `clientes/${clientFolder}/${nomeArquivo}`;
        
        const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });
        
        const { error: uploadError } = await supabase.storage
          .from('contracts')
          .upload(filePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.warn('Erro ao salvar contrato no storage:', uploadError);
        } else {
          console.log('Contrato salvo no storage:', filePath);
          toast.success("Contrato salvo na pasta do cliente");
        }
      } catch (storageError) {
        console.warn('Erro ao fazer upload do contrato:', storageError);
      }
      
      doc.save(nomeArquivo);
      
      // Chamar automação para registrar contrato e sincronizar com ADVBOX
      try {
        console.log('Iniciando automação de contrato...');
        
        const firstOption = initialFeeOptions[0];
        const valorTotalNum = firstOption?.valorTotal ? parseFloat(firstOption.valorTotal.replace(/\./g, '').replace(',', '.')) : null;
        const valorParcelaNum = firstOption?.valorParcela ? parseFloat(firstOption.valorParcela.replace(/\./g, '').replace(',', '.')) : null;
        const valorEntradaNum = firstOption?.valorEntrada ? parseFloat(firstOption.valorEntrada.replace(/\./g, '').replace(',', '.')) : null;
        const numParcelas = firstOption?.numeroParcelas ? parseInt(firstOption.numeroParcelas) : null;
        
        const contractData = {
          client: client,
          productName: productName,
          objetoContrato: objetoContrato,
          valorTotal: valorTotalNum,
          formaPagamento: firstOption?.tipoHonorarios === 'avista' 
            ? formatarFormasPagamento(firstOption.formasPagamento)
            : `Parcelado ${formatarFormasPagamento(firstOption?.formasPagamentoParcelas || [])}`,
          numeroParcelas: numParcelas,
          valorParcela: valorParcelaNum,
          valorEntrada: valorEntradaNum,
          dataVencimento: firstOption?.dataVencimento,
          temHonorariosExito: temHonorariosExito,
          descricaoExito: temHonorariosExito ? exitoOptions.map(o => o.descricao).filter(d => d).join('; ') : null,
          qualification: qualification,
          comoConheceu: client.comoConheceu,
        };
        
        const { data: automationResult, error: automationError } = await supabase.functions.invoke('contract-automation', {
          body: contractData,
        });
        
        if (automationError) {
          console.error('Erro na automação:', automationError);
          toast.warning("Contrato gerado, mas houve erro na automação", {
            description: "O registro no ADVBOX pode não ter sido feito automaticamente.",
          });
        } else {
          console.log('Automação concluída:', automationResult);
          
          // Salvar o ID do contrato para vincular ao ZapSign
          if (automationResult.contractId) {
            setContratoId(automationResult.contractId);
          }
          
          if (automationResult.syncStatus === 'synced') {
            toast.success("Contrato gerado e sincronizado!", {
              description: "Cliente e processo registrados no ADVBOX e financeiro.",
              action: {
                label: "Salvar no Teams",
                onClick: () => setShowSaveToTeams(true),
              },
              duration: 10000,
            });
          } else if (automationResult.syncStatus === 'partial') {
            toast.warning("Contrato registrado parcialmente", {
              description: automationResult.message,
              action: {
                label: "Salvar no Teams",
                onClick: () => setShowSaveToTeams(true),
              },
              duration: 10000,
            });
          } else {
            toast.info("Contrato gerado e registrado", {
              description: automationResult.message || "Sincronização com ADVBOX pendente.",
              action: {
                label: "Salvar no Teams",
                onClick: () => setShowSaveToTeams(true),
              },
              duration: 10000,
            });
          }
        }
      } catch (automationCatchError) {
        console.error('Erro ao chamar automação:', automationCatchError);
        // Não bloquear a geração do contrato por erro na automação
        toast.success("Contrato gerado com sucesso!", {
          description: "Deseja salvar também no SharePoint/Teams?",
          action: {
            label: "Salvar no Teams",
            onClick: () => setShowSaveToTeams(true),
          },
          duration: 10000,
        });
      }
      
      // Perguntar se deseja enviar para assinatura digital
      setShowZapSignConfirm(true);
      setShowPreview(false);
      
    } catch (error) {
      console.error('Erro ao gerar contrato:', error);
      toast.error("Erro ao gerar contrato. Tente novamente.");
    } finally {
      setGerandoContrato(false);
    }
  };

  const voltarParaEdicao = () => {
    setShowPreview(false);
  };

  // Renderizar opção de honorário inicial
  const renderInitialFeeOption = (opcao: InitialFeeOption, index: number) => (
    <div key={opcao.id} className="space-y-4 p-4 rounded-lg border">
      <div className="flex items-center justify-between">
        <Label className="font-medium">
          {initialFeeOptions.length > 1 ? `Opção de Pagamento ${index + 1}` : 'Pagamento'}
        </Label>
        {initialFeeOptions.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removerOpcaoInicial(opcao.id)}
            className="h-6 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Remover
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        <Label>Tipo de pagamento *</Label>
        <RadioGroup
          value={opcao.tipoHonorarios}
          onValueChange={(v) => atualizarOpcaoInicial(opcao.id, 'tipoHonorarios', v as "avista" | "parcelado")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="avista" id={`avista-${opcao.id}`} />
            <Label htmlFor={`avista-${opcao.id}`} className="cursor-pointer">À vista</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="parcelado" id={`parcelado-${opcao.id}`} />
            <Label htmlFor={`parcelado-${opcao.id}`} className="cursor-pointer">Parcelado</Label>
          </div>
        </RadioGroup>
      </div>
  
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor total (R$) *</Label>
          <Input
            placeholder="0,00"
            value={opcao.valorTotal}
            onChange={(e) => atualizarOpcaoInicial(opcao.id, 'valorTotal', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Data de vencimento *</Label>
          <Input
            placeholder="Ex: 10/01/2025 ou dia 10"
            value={opcao.dataVencimento}
            onChange={(e) => atualizarOpcaoInicial(opcao.id, 'dataVencimento', e.target.value)}
          />
        </div>
      </div>
      
      {opcao.tipoHonorarios === 'avista' && (
        <div className="space-y-2">
          <Label>Formas de pagamento * <span className="text-xs text-muted-foreground">(selecione uma ou mais)</span></Label>
          <div className="flex flex-wrap gap-3">
            {['pix', 'cartao', 'boleto'].map((forma) => (
              <label key={forma} className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={opcao.formasPagamento.includes(forma)}
                  onCheckedChange={() => atualizarOpcaoInicial(opcao.id, 'formasPagamento', toggleFormaPagamentoHelper(opcao.formasPagamento, forma))}
                />
                <span className="text-sm">{forma === 'pix' ? 'PIX' : forma === 'cartao' ? 'Cartão de Crédito' : 'Boleto Bancário'}</span>
              </label>
            ))}
          </div>
          {opcao.formasPagamento.length > 1 && (
            <p className="text-xs text-muted-foreground">
              No contrato: "{formatarFormasPagamento(opcao.formasPagamento)}"
            </p>
          )}
        </div>
      )}
      
      {opcao.tipoHonorarios === 'parcelado' && (
        <>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="cursor-pointer font-medium">Possui entrada?</Label>
              <p className="text-xs text-muted-foreground">Ex: entrada via PIX + parcelas via boleto</p>
            </div>
            <Switch
              checked={opcao.temEntrada}
              onCheckedChange={(v) => atualizarOpcaoInicial(opcao.id, 'temEntrada', v)}
            />
          </div>
          
          {opcao.temEntrada && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
              <Label className="text-sm font-medium">Entrada</Label>
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input
                  placeholder="0,00"
                  value={opcao.valorEntrada}
                  onChange={(e) => atualizarOpcaoInicial(opcao.id, 'valorEntrada', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Formas de pagamento *</Label>
                <div className="flex flex-wrap gap-3">
                  {['pix', 'cartao', 'boleto'].map((forma) => (
                    <label key={forma} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={opcao.formasPagamentoEntrada.includes(forma)}
                        onCheckedChange={() => atualizarOpcaoInicial(opcao.id, 'formasPagamentoEntrada', toggleFormaPagamentoHelper(opcao.formasPagamentoEntrada, forma))}
                      />
                      <span className="text-sm">{forma === 'pix' ? 'PIX' : forma === 'cartao' ? 'Cartão' : 'Boleto'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número de parcelas *</Label>
              <Input
                placeholder="Ex: 12"
                value={opcao.numeroParcelas}
                onChange={(e) => atualizarOpcaoInicial(opcao.id, 'numeroParcelas', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor da parcela (R$) *</Label>
              <Input
                placeholder="0,00"
                value={opcao.valorParcela}
                onChange={(e) => atualizarOpcaoInicial(opcao.id, 'valorParcela', e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Forma de pagamento das parcelas *</Label>
            <div className="flex flex-wrap gap-3">
              {['pix', 'cartao', 'boleto'].map((forma) => (
                <label key={forma} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox 
                    checked={opcao.formasPagamentoParcelas.includes(forma)}
                    onCheckedChange={() => atualizarOpcaoInicial(opcao.id, 'formasPagamentoParcelas', toggleFormaPagamentoHelper(opcao.formasPagamentoParcelas, forma))}
                  />
                  <span className="text-sm">{forma === 'pix' ? 'PIX' : forma === 'cartao' ? 'Cartão' : 'Boleto'}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={async (isOpen) => {
      if (!isOpen && client && user) {
        // Auto-save draft silently on close if there's data
        const hasData = contraPartida.trim() || objetoContrato.trim() || clausulaPrimeiraGerada.trim() || 
          initialFeeOptions.some(o => o.valorTotal.trim()) || exitoOptions.some(o => o.descricao.trim());
        if (hasData) {
          try {
            const firstOption = initialFeeOptions[0];
            const draftData = {
              user_id: user.id,
              client_id: client.id,
              client_name: client.nomeCompleto,
              product_name: productName,
              qualification: qualification,
              contra_partida: contraPartida,
              objeto_contrato: objetoContrato,
              clausula_primeira_gerada: clausulaPrimeiraGerada,
              tipo_honorarios: firstOption?.tipoHonorarios || "avista",
              valor_total: firstOption?.valorTotal || "",
              numero_parcelas: firstOption?.numeroParcelas || "",
              valor_parcela: firstOption?.valorParcela || "",
              tem_entrada: firstOption?.temEntrada || false,
              valor_entrada: firstOption?.valorEntrada || "",
              forma_pagamento: firstOption?.formasPagamento.join(',') || "pix",
              data_vencimento: firstOption?.dataVencimento || "",
              tem_honorarios_exito: temHonorariosExito,
              descricao_honorarios_exito: exitoOptions.map(o => o.descricao).join(' | '),
              clausula_exito_gerada: exitoOptions.map(o => o.clausulaGerada).join('\n\n'),
              contract_preview_text: contractPreviewText,
            };

            if (rascunhoExistente) {
              await supabase.from('contract_drafts').update(draftData).eq('id', rascunhoExistente);
            } else {
              const { data } = await supabase.from('contract_drafts').insert(draftData).select('id').single();
              if (data) setRascunhoExistente(data.id);
            }
            console.log('Rascunho de contrato salvo automaticamente');
          } catch (error) {
            console.error('Erro ao auto-salvar rascunho:', error);
          }
        }
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              {isContratoBSB() ? 'Gerador de Contrato - Processos BSB' : 'Gerador de Contrato Padrão'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {rascunhoExistente && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={carregarRascunho}
                    disabled={carregandoRascunho}
                    title="Carregar rascunho salvo"
                  >
                    {carregandoRascunho ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deletarRascunho}
                    disabled={deletandoRascunho}
                    title="Excluir rascunho"
                    className="text-destructive hover:text-destructive"
                  >
                    {deletandoRascunho ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={salvarRascunho}
                disabled={salvandoRascunho}
                title="Salvar rascunho"
              >
                {salvandoRascunho ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
          <DialogDescription>
            Preencha os dados para gerar o contrato de {client?.nomeCompleto?.split(' ')[0]} - {productName}
            {rascunhoExistente && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Rascunho disponível
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Aviso para contratos BSB */}
            {isContratoBSB() && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="default" className="mt-0.5">BSB</Badge>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Modelo específico para Processos de Brasília</p>
                      <p className="text-xs text-muted-foreground">
                        Este contrato utiliza um modelo específico com múltiplos escritórios contratados e cláusula primeira fixa 
                        (reajuste/isonomia FNDE). Apenas preencha os honorários abaixo.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Cláusula Primeira - Objeto (escondido para BSB) */}
            {!isContratoBSB() && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Cláusula Primeira - Objeto do Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parte Contrária com Templates */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="contraPartida">Em face de (parte contrária) *</Label>
                    <div className="flex gap-1">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateDefaultContraPartidaTemplate(true)}
                          className="h-6 text-xs px-2"
                        >
                          + Padrão
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSaveContraPartidaTemplate(true)}
                        className="h-6 text-xs px-2"
                        disabled={!contraPartida.trim()}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                  
                  {contraPartidaTemplates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {contraPartidaTemplates.map((template) => (
                        <div key={template.id} className="flex items-center gap-1">
                          <Badge 
                            variant={selectedContraPartidaTemplateId === template.id ? "default" : (template.is_default ? "secondary" : "outline")}
                            className={`cursor-pointer hover:bg-primary/10 ${selectedContraPartidaTemplateId === template.id ? 'ring-2 ring-primary' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Substituir completamente o valor atual pelo template selecionado
                              const novoValor = template.description;
                              setContraPartida(novoValor);
                              setSelectedContraPartidaTemplateId(template.id);
                            }}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {template.name}
                            {template.is_default && <span className="ml-1 text-[10px] opacity-60">(padrão)</span>}
                            {selectedContraPartidaTemplateId === template.id && <span className="ml-1 text-[10px]">✓</span>}
                          </Badge>
                          {(!template.is_default || isAdmin) && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deletarContraPartidaTemplate(template.id, template.is_default);
                              }}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {(showSaveContraPartidaTemplate || showCreateDefaultContraPartidaTemplate) && (
                    <div className="flex gap-2 items-center p-2 rounded bg-muted/50">
                      <Input
                        placeholder="Nome do template"
                        value={contraPartidaTemplateName}
                        onChange={(e) => setContraPartidaTemplateName(e.target.value)}
                        className="h-8"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => salvarContraPartidaTemplate(showCreateDefaultContraPartidaTemplate)}
                        disabled={savingContraPartidaTemplate || !contraPartidaTemplateName.trim()}
                        className="h-8"
                      >
                        {savingContraPartidaTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setShowSaveContraPartidaTemplate(false);
                          setShowCreateDefaultContraPartidaTemplate(false);
                          setContraPartidaTemplateName("");
                        }}
                        className="h-8"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  <Input
                    id="contraPartida"
                    key={`contraPartida-${selectedContraPartidaTemplateId || 'manual'}`}
                    placeholder="Ex: Estado de Minas Gerais, INSS, União Federal..."
                    value={contraPartida}
                    onChange={(e) => {
                      setContraPartida(e.target.value);
                      // Se editar manualmente, desmarcar o template selecionado
                      if (selectedContraPartidaTemplateId) {
                        setSelectedContraPartidaTemplateId(null);
                      }
                    }}
                  />
                </div>
                
                {/* Objeto do Contrato com Templates */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="objetoContrato">Objeto do contrato (o que será requerido) *</Label>
                    <div className="flex gap-1">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateDefaultObjetoContratoTemplate(true)}
                          className="h-6 text-xs px-2"
                        >
                          + Padrão
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSaveObjetoContratoTemplate(true)}
                        className="h-6 text-xs px-2"
                        disabled={!objetoContrato.trim()}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                  
                  {objetoContratoTemplates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {objetoContratoTemplates.map((template) => (
                        <div key={template.id} className="flex items-center gap-1">
                          <Badge 
                            variant={selectedObjetoContratoTemplateId === template.id ? "default" : (template.is_default ? "secondary" : "outline")}
                            className={`cursor-pointer hover:bg-primary/10 ${selectedObjetoContratoTemplateId === template.id ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => {
                              setObjetoContrato(template.description);
                              setSelectedObjetoContratoTemplateId(template.id);
                            }}
                          >
                            <FileEdit className="h-3 w-3 mr-1" />
                            {template.name}
                            {template.is_default && <span className="ml-1 text-[10px] opacity-60">(padrão)</span>}
                            {selectedObjetoContratoTemplateId === template.id && <span className="ml-1 text-[10px]">✓</span>}
                          </Badge>
                          {(!template.is_default || isAdmin) && (
                            <button
                              onClick={() => deletarObjetoContratoTemplate(template.id, template.is_default)}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {(showSaveObjetoContratoTemplate || showCreateDefaultObjetoContratoTemplate) && (
                    <div className="flex gap-2 items-center p-2 rounded bg-muted/50">
                      <Input
                        placeholder="Nome do template"
                        value={objetoContratoTemplateName}
                        onChange={(e) => setObjetoContratoTemplateName(e.target.value)}
                        className="h-8"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => salvarObjetoContratoTemplate(showCreateDefaultObjetoContratoTemplate)}
                        disabled={savingObjetoContratoTemplate || !objetoContratoTemplateName.trim()}
                        className="h-8"
                      >
                        {savingObjetoContratoTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setShowSaveObjetoContratoTemplate(false);
                          setShowCreateDefaultObjetoContratoTemplate(false);
                          setObjetoContratoTemplateName("");
                        }}
                        className="h-8"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                  
                  <Textarea
                    id="objetoContrato"
                    placeholder="Ex: revisão de aposentadoria com inclusão do adicional de insalubridade..."
                    value={objetoContrato}
                    onChange={(e) => setObjetoContrato(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                
                {/* Botão salvar templates para este produto */}
                {(selectedContraPartidaTemplateId || selectedObjetoContratoTemplateId) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={salvarAssociacaoProduto}
                    disabled={savingProductAssociation}
                    className="w-full"
                  >
                    {savingProductAssociation ? (
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-2" />
                    )}
                    Salvar templates selecionados para "{productName}"
                  </Button>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      if (!contraPartida.trim() || !objetoContrato.trim()) {
                        toast.error("Preencha a parte contrária e o objeto do contrato");
                        return;
                      }
                      const clausulaManual = `Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante, em face do ${contraPartida.trim()}, a ${objetoContrato.trim()}.`;
                      setClausulaPrimeiraGerada(clausulaManual);
                      toast.success("Cláusula criada! Você pode editá-la abaixo.");
                    }}
                    disabled={!contraPartida || !objetoContrato}
                    variant="outline"
                    className="flex-1"
                  >
                    <FileEdit className="h-4 w-4 mr-2" />
                    Usar Texto Manual
                  </Button>
                  <Button 
                    onClick={gerarClausulaPrimeira} 
                    disabled={gerandoClausulaPrimeira || !contraPartida || !objetoContrato}
                    className="flex-1"
                  >
                    {gerandoClausulaPrimeira ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Gerar com IA
                  </Button>
                </div>
                
                {clausulaPrimeiraGerada && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Cláusula gerada:</Label>
                      <Badge variant="secondary" className="text-xs">
                        Editável
                      </Badge>
                    </div>
                    <Textarea
                      value={clausulaPrimeiraGerada}
                      onChange={(e) => setClausulaPrimeiraGerada(e.target.value)}
                      className="min-h-[100px] text-sm"
                    />
                    {/* Opção de salvar cláusula gerada como template de objeto do contrato */}
                    {!showSaveObjetoContratoTemplate && !showCreateDefaultObjetoContratoTemplate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Usar o objeto do contrato original como template
                          setShowCreateDefaultObjetoContratoTemplate(true);
                        }}
                        className="w-full text-xs"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar objeto do contrato como template geral
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
            
            {!isContratoBSB() && <Separator />}
            
            {/* Cláusula Terceira - Honorários Iniciais */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cláusula Terceira - Honorários Iniciais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label className="cursor-pointer font-medium">
                      Possui honorários iniciais?
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Desative caso o cliente contrate apenas honorários de êxito
                    </p>
                  </div>
                  <Switch
                    checked={temHonorariosIniciais}
                    onCheckedChange={setTemHonorariosIniciais}
                  />
                </div>
                
                {temHonorariosIniciais && (
                  <>
                    <Separator />

                    {/* Templates de honorários iniciais */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Templates disponíveis</Label>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCreateDefaultTemplate(true)}
                            className="h-6 text-xs px-2"
                          >
                            + Novo Template Padrão
                          </Button>
                        )}
                      </div>
                      {initialFeeTemplates.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {initialFeeTemplates.map((template) => (
                            <div key={template.id} className="flex items-center gap-1">
                              <Badge 
                                variant={template.is_default ? "secondary" : "outline"}
                                className="cursor-pointer hover:bg-primary/10"
                                onClick={() => carregarTemplateInicial(template)}
                                title={template.descricao || template.name}
                              >
                                {template.name}
                                {template.is_default && <span className="ml-1 text-[10px] opacity-60">(padrão)</span>}
                              </Badge>
                              {(!template.is_default || isAdmin) && (
                                <button
                                  onClick={() => deletarTemplateInicial(template.id, template.is_default)}
                                  className="text-muted-foreground hover:text-destructive p-0.5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Múltiplas opções de honorários iniciais */}
                    {initialFeeOptions.map((opcao, index) => renderInitialFeeOption(opcao, index))}
                    
                    {/* Botão adicionar opção */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={adicionarOpcaoInicial}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar outra opção de pagamento
                    </Button>
                    
                    {/* Salvar como template geral */}
                    {!showSaveInitialTemplate && !showCreateDefaultTemplate && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowCreateDefaultTemplate(true)}
                        className="w-full text-xs"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar primeira opção como template geral
                      </Button>
                    )}

                    {showSaveInitialTemplate && (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                        <div className="space-y-1">
                          <Label htmlFor="initialTemplateName" className="text-xs">Nome do template</Label>
                          <Input
                            id="initialTemplateName"
                            placeholder="Ex: Parcelado 12x cartão"
                            value={initialTemplateName}
                            onChange={(e) => setInitialTemplateName(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="initialTemplateDescricao" className="text-xs">Descrição (opcional)</Label>
                          <Input
                            id="initialTemplateDescricao"
                            placeholder="Ex: 12 parcelas no cartão de crédito"
                            value={initialTemplateDescricao}
                            onChange={(e) => setInitialTemplateDescricao(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={salvarTemplateInicial}
                            disabled={savingInitialTemplate || !initialTemplateName.trim()}
                            className="h-8"
                          >
                            {savingInitialTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowSaveInitialTemplate(false);
                              setInitialTemplateName("");
                              setInitialTemplateDescricao("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {showCreateDefaultTemplate && isAdmin && (
                      <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Label className="text-xs font-medium text-primary">Criar Template Padrão (visível para todos)</Label>
                        <div className="space-y-1">
                          <Label htmlFor="defaultTemplateName" className="text-xs">Nome do template</Label>
                          <Input
                            id="defaultTemplateName"
                            placeholder="Ex: Parcelado 12x com entrada"
                            value={initialTemplateName}
                            onChange={(e) => setInitialTemplateName(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="defaultTemplateDescricao" className="text-xs">Descrição (opcional)</Label>
                          <Input
                            id="defaultTemplateDescricao"
                            placeholder="Ex: Entrada R$ 1.200 PIX + 12x boleto"
                            value={initialTemplateDescricao}
                            onChange={(e) => setInitialTemplateDescricao(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={criarTemplatePadrao}
                            disabled={savingInitialTemplate || !initialTemplateName.trim()}
                            className="h-8"
                          >
                            {savingInitialTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar Template Padrão"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowCreateDefaultTemplate(false);
                              setInitialTemplateName("");
                              setInitialTemplateDescricao("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            <Separator />
            
            {/* Honorários de Êxito */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Honorários de Êxito
                  </CardTitle>
                  <Switch
                    checked={temHonorariosExito}
                    onCheckedChange={setTemHonorariosExito}
                  />
                </div>
              </CardHeader>
              {temHonorariosExito && (
                <CardContent className="space-y-4">
                  {/* Templates salvos e padrão */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Templates disponíveis</Label>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateDefaultExitoTemplate(true)}
                          className="h-6 text-xs px-2"
                        >
                          + Novo Template Padrão
                        </Button>
                      )}
                    </div>
                    {templates.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {templates.map((template) => (
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
                    )}
                  </div>

                  {/* Múltiplas opções de êxito */}
                  {exitoOptions.map((opcao, index) => (
                    <div key={opcao.id} className="space-y-3 p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {exitoOptions.length > 1 ? `Opção ${index + 1}` : 'Descrição dos honorários de êxito *'}
                        </Label>
                        {exitoOptions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerOpcaoExito(opcao.id)}
                            className="h-6 text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remover
                          </Button>
                        )}
                      </div>
                      
                      <Textarea
                        placeholder="Ex: 30% dos 12 primeiros meses de pagamento..."
                        value={opcao.descricao}
                        onChange={(e) => atualizarDescricaoExito(opcao.id, e.target.value)}
                        className="min-h-[60px]"
                      />
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => {
                            if (!opcao.descricao.trim()) {
                              toast.error("Preencha a descrição dos honorários de êxito");
                              return;
                            }
                            setExitoOptions(prev => prev.map(o => 
                              o.id === opcao.id ? { ...o, clausulaGerada: opcao.descricao.trim() } : o
                            ));
                            toast.success("Texto manual adicionado! Você pode editá-lo abaixo.");
                          }}
                          disabled={!opcao.descricao.trim()}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <FileEdit className="h-4 w-4 mr-1" />
                          Usar Manual
                        </Button>
                        <Button 
                          onClick={() => gerarClausulaExitoParaOpcao(opcao.id)} 
                          disabled={opcao.gerando || !opcao.descricao.trim()}
                          size="sm"
                          className="flex-1"
                        >
                          {opcao.gerando ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          Gerar com IA
                        </Button>
                      </div>
                      
                      {opcao.clausulaGerada && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Cláusula gerada:</Label>
                            <Badge variant="secondary" className="text-xs">
                              Editável
                            </Badge>
                          </div>
                          <Textarea
                            value={opcao.clausulaGerada}
                            onChange={(e) => atualizarClausulaExito(opcao.id, e.target.value)}
                            className="min-h-[80px] text-sm"
                          />
                          {/* Opção de salvar cláusula gerada como template */}
                          {!showSaveTemplate && !showCreateDefaultExitoTemplate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Usar a cláusula gerada como descrição do template
                                setExitoOptions(prev => prev.map(o => 
                                  o.id === opcao.id ? { ...o, descricao: opcao.clausulaGerada } : o
                                ));
                                setShowCreateDefaultExitoTemplate(true);
                              }}
                              className="w-full text-xs"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Salvar cláusula gerada como template geral
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Botão adicionar opção */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={adicionarOpcaoExito}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar outra opção de êxito
                  </Button>

                  {/* Salvar como template geral */}
                  {exitoOptions[0]?.descricao && !showSaveTemplate && !showCreateDefaultExitoTemplate && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowCreateDefaultExitoTemplate(true)}
                      className="w-full text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Salvar primeira opção como template geral
                    </Button>
                  )}

                  {showSaveTemplate && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <Label htmlFor="templateName" className="text-xs">Nome do template</Label>
                        <Input
                          id="templateName"
                          placeholder="Ex: Êxito 20% - Padrão"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={salvarTemplate}
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

                  {showCreateDefaultExitoTemplate && isAdmin && (
                    <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Label className="text-xs font-medium text-primary">Criar Template Padrão (visível para todos)</Label>
                      <div className="space-y-1">
                        <Label htmlFor="defaultExitoTemplateName" className="text-xs">Nome do template</Label>
                        <Input
                          id="defaultExitoTemplateName"
                          placeholder="Ex: Êxito 30% retroativos"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Será usado o texto da primeira opção de êxito: "{exitoOptions[0]?.descricao?.substring(0, 50) || '...'}..."
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={criarTemplatePadraoExito}
                          disabled={savingTemplate || !templateName.trim() || !exitoOptions[0]?.descricao}
                          className="h-8"
                        >
                          {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar Template Padrão"}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setShowCreateDefaultExitoTemplate(false);
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
        </ScrollArea>
        
        {/* Pré-visualização */}
        {showPreview ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  <FileText className="h-3 w-3 mr-1" />
                  Pré-visualização do Contrato
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Edite o texto abaixo se necessário antes de gerar o PDF
                </p>
              </div>
              <Textarea
                value={contractPreviewText}
                onChange={(e) => setContractPreviewText(e.target.value)}
                className="min-h-[60vh] font-mono text-sm leading-relaxed"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={voltarParaEdicao}>
                Voltar e Editar
              </Button>
              <Button 
                onClick={gerarContratoPDF} 
                disabled={gerandoContrato}
              >
                {gerandoContrato ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Gerar PDF Final
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={abrirPreview} 
              disabled={!clausulaPrimeiraGerada || (temHonorariosIniciais && (!initialFeeOptions[0]?.valorTotal || !initialFeeOptions[0]?.dataVencimento))}
            >
              <FileText className="h-4 w-4 mr-2" />
              Pré-visualizar Contrato
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    {/* Dialog para salvar no Teams */}
    <SaveToTeamsDialog
      open={showSaveToTeams}
      onOpenChange={setShowSaveToTeams}
      fileName={pdfForTeams?.fileName || ''}
      fileContent={pdfForTeams?.content || ''}
      clientName={client?.nomeCompleto}
      onSuccess={() => {
        toast.success('Contrato salvo no Teams com sucesso!');
        setShowSaveToTeams(false);
        setPdfForTeams(null);
      }}
    />

    {/* Dialog de confirmação ZapSign */}
    <Dialog open={showZapSignConfirm} onOpenChange={setShowZapSignConfirm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar para Assinatura Digital?
          </DialogTitle>
          <DialogDescription>
            O contrato foi gerado com sucesso. Deseja enviá-lo para assinatura eletrônica via ZapSign?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowZapSignConfirm(false);
              // Perguntar se deseja cadastrar manualmente no ADVBox
              setShowAdvboxManualConfirm(true);
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

    {/* Dialog para cadastro manual no ADVBox */}
    <Dialog open={showAdvboxManualConfirm} onOpenChange={setShowAdvboxManualConfirm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Cadastrar no ADVBox?
          </DialogTitle>
          <DialogDescription>
            Como o contrato não foi enviado para assinatura digital, você pode cadastrar manualmente o cliente e processo no ADVBox agora.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowAdvboxManualConfirm(false);
              onOpenChange(false);
            }}
            disabled={registrandoAdvboxManual}
          >
            Mais tarde
          </Button>
          <Button
            onClick={async () => {
              if (!contratoId) {
                toast.error("ID do contrato não encontrado");
                setShowAdvboxManualConfirm(false);
                onOpenChange(false);
                return;
              }
              
              setRegistrandoAdvboxManual(true);
              try {
                const { data, error } = await supabase.functions.invoke('advbox-manual-registration', {
                  body: { contrato_id: contratoId },
                });
                
                if (error) throw error;
                
                if (data.success) {
                  toast.success('Cliente e processo cadastrados no ADVBox!', {
                    description: 'Uma tarefa foi criada para a coordenadora analisar o caso.',
                  });
                } else {
                  throw new Error(data.error || 'Erro desconhecido');
                }
              } catch (err) {
                console.error('Erro ao cadastrar no ADVBox:', err);
                toast.error('Erro ao cadastrar no ADVBox', {
                  description: err instanceof Error ? err.message : 'Erro desconhecido',
                });
              } finally {
                setRegistrandoAdvboxManual(false);
                setShowAdvboxManualConfirm(false);
                onOpenChange(false);
              }
            }}
            disabled={registrandoAdvboxManual}
          >
            {registrandoAdvboxManual ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Cadastrar no ADVBox
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
      documentType="contrato"
      documentName={documentNameForZapSign}
      pdfBase64={pdfBase64ForZapSign}
      clientName={client?.nomeCompleto || ''}
      clientEmail={client?.email}
      clientPhone={client?.telefone}
      clientCpf={client?.cpf}
      contratoId={contratoId || undefined}
      onSuccess={(signUrl) => {
        console.log('Contrato enviado para assinatura:', signUrl);
      }}
    />
    </>
  );
};

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileSignature, 
  Loader2, 
  Send, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  Camera,
  CreditCard,
  Mail,
  MessageCircle,
  AlertCircle,
  Building2,
  User,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ZapSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'contrato' | 'procuracao';
  documentName: string;
  pdfBase64: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCpf?: string;
  onSuccess?: (signUrl: string) => void;
  contratoId?: string;
}

interface ZapSignResult {
  success: boolean;
  documentToken: string;
  signUrl: string;
  isContract?: boolean;
  autoSignResults?: {
    marcos: boolean;
    rafael: boolean;
    witness1: boolean;
    witness2: boolean;
  };
  witness1Name?: string;
  witness2Name?: string;
  signers: Array<{
    name: string;
    email: string;
    signUrl: string;
    status: string;
  }>;
}

const WITNESSES = [
  { key: 'daniel', label: 'Daniel' },
  { key: 'lucas', label: 'Lucas' },
];

export const ZapSignDialog = ({
  open,
  onOpenChange,
  documentType,
  documentName,
  pdfBase64,
  clientName,
  clientEmail,
  clientPhone,
  clientCpf,
  onSuccess,
  contratoId,
}: ZapSignDialogProps) => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ZapSignResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(false);
  const [sendViaEmail, setSendViaEmail] = useState(true);

  const [editableEmail, setEditableEmail] = useState(clientEmail || "");
  const [editablePhone, setEditablePhone] = useState(clientPhone || "");

  // Testemunhas selecionadas (apenas para contratos)
  const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>(['daniel', 'lucas']);

  const toggleWitness = (key: string) => {
    setSelectedWitnesses(prev => {
      if (prev.includes(key)) {
        return prev.filter(w => w !== key);
      }
      if (prev.length >= 2) {
        // Substituir o mais antigo
        return [prev[1], key];
      }
      return [...prev, key];
    });
  };

  const witnessesValid = documentType !== 'contrato' || selectedWitnesses.length === 2;

  const handleSendToZapSign = async () => {
    if (documentType === 'contrato' && selectedWitnesses.length !== 2) {
      toast.error('Selecione exatamente 2 testemunhas');
      return;
    }

    setSending(true);
    setError(null);
    setResult(null);

    try {
      console.log('Enviando documento para ZapSign...');
      
      const witnesses = documentType === 'contrato' 
        ? selectedWitnesses.map(key => ({
            name: WITNESSES.find(w => w.key === key)?.label || key,
            tokenKey: key,
          }))
        : undefined;

      const { data, error: invokeError } = await supabase.functions.invoke('zapsign-integration', {
        body: {
          documentType,
          documentName,
          pdfBase64,
          clientName,
          clientEmail: editableEmail || clientEmail,
          clientPhone: editablePhone || clientPhone,
          clientCpf,
          requireSelfie: true,
          requireDocumentPhoto: true,
          sendViaWhatsapp,
          sendViaEmail,
          includeOfficeSigner: documentType === 'contrato',
          contratoId,
          witnesses,
        },
      });

      if (invokeError) {
        console.error('Erro ao invocar função:', invokeError);
        throw new Error(invokeError.message || 'Erro ao enviar para ZapSign');
      }

      if (data?.error) {
        console.error('Erro retornado pela API:', data);
        const friendlyMessage = data.userMessage || data.details || data.error;
        throw new Error(friendlyMessage);
      }

      console.log('Resposta do ZapSign:', data);
      setResult(data);
      
      if (contratoId && data.documentToken) {
        try {
          await supabase.from('fin_contratos').update({
            assinatura_status: 'pending_signature',
            zapsign_document_id: data.documentToken,
          }).eq('id', contratoId);
        } catch (updateError) {
          console.error('Erro ao atualizar contrato:', updateError);
        }
      }
      
      toast.success('Documento enviado para assinatura!', {
        description: 'O link de assinatura foi gerado com sucesso.',
      });

      if (onSuccess && data.signUrl) {
        onSuccess(data.signUrl);
      }

    } catch (err) {
      console.error('Erro ao enviar para ZapSign:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error('Erro ao enviar documento', { description: errorMessage });
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  const documentTypeLabel = documentType === 'contrato' ? 'Contrato' : 'Procuração';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Enviar para Assinatura Digital
          </DialogTitle>
          <DialogDescription>
            Envie {documentTypeLabel.toLowerCase()} para assinatura eletrônica via ZapSign
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 py-4">
            {/* Informações do documento */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Documento:</span>
                  <Badge variant="secondary">{documentTypeLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-sm">{clientName}</span>
                </div>
                {clientCpf && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CPF:</span>
                    <span className="text-sm">{clientCpf}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dados de contato editáveis */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Dados para envio do link</h4>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="zapsign-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail do cliente
                  </Label>
                  <Input
                    id="zapsign-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zapsign-phone" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp do cliente
                  </Label>
                  <Input
                    id="zapsign-phone"
                    type="tel"
                    placeholder="(31) 99999-9999"
                    value={editablePhone}
                    onChange={(e) => setEditablePhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Autenticação do cliente */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Camera className="h-4 w-4" />
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Autenticação completa obrigatória</p>
                    <p className="text-xs text-muted-foreground">
                      O cliente precisará tirar uma selfie e fotografar seu documento de identidade para assinar.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seleção de testemunhas - apenas para contratos */}
            {documentType === 'contrato' && (
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Assinaturas automáticas</p>
                      <p className="text-xs text-muted-foreground">
                        O contrato será assinado automaticamente por:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                        <li>Marcos Luiz Egg Nunes (1º Contratado)</li>
                        <li>Rafael Egg Nunes (2º Contratado)</li>
                        <li>2 Testemunhas selecionadas abaixo</li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-1">
                        O cliente receberá o link para completar sua assinatura.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <Label className="text-sm font-medium">Testemunhas (selecione 2)</Label>
                    </div>
                    <div className="space-y-2">
                      {WITNESSES.map((witness) => (
                        <div key={witness.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`witness-${witness.key}`}
                            checked={selectedWitnesses.includes(witness.key)}
                            onCheckedChange={() => toggleWitness(witness.key)}
                          />
                          <Label
                            htmlFor={`witness-${witness.key}`}
                            className="text-sm cursor-pointer"
                          >
                            {witness.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedWitnesses.length !== 2 && (
                      <p className="text-xs text-destructive">
                        Selecione exatamente 2 testemunhas para prosseguir.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Opções de envio automático */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Envio automático (opcional)</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="send-email" className="cursor-pointer">
                      Enviar por e-mail
                    </Label>
                  </div>
                  <Switch
                    id="send-email"
                    checked={sendViaEmail}
                    onCheckedChange={setSendViaEmail}
                    disabled={!editableEmail}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="send-whatsapp" className="cursor-pointer">
                      Enviar por WhatsApp
                    </Label>
                  </div>
                  <Switch
                    id="send-whatsapp"
                    checked={sendViaWhatsapp}
                    onCheckedChange={setSendViaWhatsapp}
                    disabled={!editablePhone}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Se não enviar automaticamente, você receberá o link para compartilhar manualmente.
              </p>
            </div>

            {error && (
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">Erro ao enviar</p>
                      <p className="text-xs text-destructive/80">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Sucesso */}
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">Documento enviado com sucesso!</h3>
              <p className="text-sm text-muted-foreground">
                {result.isContract 
                  ? 'As assinaturas internas foram processadas automaticamente. Compartilhe o link com o cliente.'
                  : 'O link de assinatura foi gerado. Compartilhe com o cliente para que ele assine.'}
              </p>
            </div>

            {/* Status das assinaturas para contratos */}
            {result.isContract && result.autoSignResults && (
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="pt-4 space-y-3">
                  <Label className="text-sm font-medium">Status das Assinaturas</Label>
                  <div className="space-y-2">
                    <SignerStatusRow
                      icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                      name="Marcos Luiz Egg Nunes"
                      role="Contratado"
                      signed={result.autoSignResults.marcos}
                    />
                    <SignerStatusRow
                      icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                      name="Rafael Egg Nunes"
                      role="Contratado"
                      signed={result.autoSignResults.rafael}
                    />
                    <SignerStatusRow
                      icon={<User className="h-4 w-4 text-muted-foreground" />}
                      name={clientName}
                      role="Contratante"
                      signed={false}
                      pending
                    />
                    {result.witness1Name && (
                      <SignerStatusRow
                        icon={<Users className="h-4 w-4 text-muted-foreground" />}
                        name={result.witness1Name}
                        role="Testemunha"
                        signed={result.autoSignResults.witness1}
                      />
                    )}
                    {result.witness2Name && (
                      <SignerStatusRow
                        icon={<Users className="h-4 w-4 text-muted-foreground" />}
                        name={result.witness2Name}
                        role="Testemunha"
                        signed={result.autoSignResults.witness2}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Link de assinatura */}
            {result.signUrl && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <Label className="text-sm font-medium">Link de assinatura do cliente</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={result.signUrl} 
                      readOnly 
                      className="text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(result.signUrl)}
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(result.signUrl, '_blank')}
                      title="Abrir link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const whatsappUrl = `https://wa.me/${editablePhone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${clientName}! Segue o link para assinatura do seu ${documentTypeLabel.toLowerCase()}: ${result.signUrl}`)}`;
                        window.open(whatsappUrl, '_blank');
                      }}
                      disabled={!editablePhone}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar via WhatsApp
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const subject = encodeURIComponent(`${documentTypeLabel} para Assinatura - Egg Nunes Advocacia`);
                        const body = encodeURIComponent(`Olá ${clientName},\n\nSegue o link para assinatura do seu ${documentTypeLabel.toLowerCase()}:\n\n${result.signUrl}\n\nAtenciosamente,\nEgg Nunes Advocacia`);
                        window.open(`mailto:${editableEmail}?subject=${subject}&body=${body}`, '_blank');
                      }}
                      disabled={!editableEmail}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar via E-mail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSendToZapSign} disabled={sending || !witnessesValid}>
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar para ZapSign
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Componente auxiliar para exibir status de cada signatário
function SignerStatusRow({ 
  icon, 
  name, 
  role, 
  signed, 
  pending 
}: { 
  icon: React.ReactNode; 
  name: string; 
  role: string; 
  signed: boolean; 
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span>{name}</span>
        <span className="text-xs text-muted-foreground">({role})</span>
      </div>
      <Badge 
        variant={signed ? "default" : "secondary"} 
        className={signed ? "bg-green-600" : ""}
      >
        {signed ? "Assinado" : (pending ? "Aguardando" : "Pendente")}
      </Badge>
    </div>
  );
}

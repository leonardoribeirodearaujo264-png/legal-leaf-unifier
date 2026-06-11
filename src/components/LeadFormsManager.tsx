import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Copy, Plus, Trash2, FileText, Code, Eye, EyeOff, ExternalLink, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import logoEggnunes from '@/assets/logo-eggnunes.png';

interface LeadForm {
  id: string;
  name: string;
  campaign_id: string | null;
  whatsapp_number: string;
  whatsapp_message: string;
  redirect_to_whatsapp: boolean;
  is_active: boolean;
  created_at: string;
}

const INITIAL_FORM_DATA = {
  name: '',
  whatsapp_number: '',
  whatsapp_message: 'Olá! Meu nome é {nome}. Gostaria de mais informações.',
  redirect_to_whatsapp: true,
};

type FormDataType = typeof INITIAL_FORM_DATA;

function FormFields({ formData, setFormData }: { formData: FormDataType; setFormData: (data: FormDataType) => void }) {
  return (
    <div className="space-y-4 py-4">
      <div className="p-3 bg-muted rounded-lg space-y-2">
        <Label className="text-sm font-semibold">Campos que o lead irá preencher:</Label>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-background">Nome *</Badge>
          <Badge variant="outline" className="bg-background">Telefone *</Badge>
          <Badge variant="outline" className="bg-background">E-mail</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          * Campos obrigatórios. Além disso, são capturados automaticamente: UTM parameters, URL da página, referrer.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Nome do Formulário *</Label>
        <Input
          placeholder="Ex: Formulário Landing Previdenciário"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Número do WhatsApp *</Label>
        <Input
          placeholder="5531999999999"
          value={formData.whatsapp_number}
          onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Formato: código do país + DDD + número (sem espaços ou traços)
        </p>
      </div>
      <div className="space-y-2">
        <Label>Mensagem do WhatsApp</Label>
        <Textarea
          placeholder="Olá! Meu nome é {nome}..."
          value={formData.whatsapp_message}
          onChange={(e) => setFormData({ ...formData, whatsapp_message: e.target.value })}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Use {'{nome}'} e {'{telefone}'} para inserir os dados do lead
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Redirecionar para WhatsApp</Label>
          <p className="text-xs text-muted-foreground">
            Abrir WhatsApp após envio do formulário
          </p>
        </div>
        <Switch
          checked={formData.redirect_to_whatsapp}
          onCheckedChange={(checked) => setFormData({ ...formData, redirect_to_whatsapp: checked })}
        />
      </div>
    </div>
  );
}

export function LeadFormsManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingForm, setEditingForm] = useState<LeadForm | null>(null);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_capture_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = () => {
    setFormData({ ...INITIAL_FORM_DATA });
  };

  const openEditDialog = (form: LeadForm) => {
    setEditingForm(form);
    setFormData({
      name: form.name,
      whatsapp_number: form.whatsapp_number,
      whatsapp_message: form.whatsapp_message,
      redirect_to_whatsapp: form.redirect_to_whatsapp,
    });
    setShowEditDialog(true);
  };

  const createForm = async () => {
    if (!formData.name || !formData.whatsapp_number) {
      toast({ title: 'Preencha nome e número do WhatsApp', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('lead_capture_forms').insert({
        name: formData.name,
        whatsapp_number: formData.whatsapp_number,
        whatsapp_message: formData.whatsapp_message,
        redirect_to_whatsapp: formData.redirect_to_whatsapp,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: 'Formulário criado!' });
      setShowCreateDialog(false);
      resetFormData();
      fetchForms();
    } catch (error) {
      console.error('Error creating form:', error);
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' });
    }
  };

  const updateForm = async () => {
    if (!editingForm) return;
    if (!formData.name || !formData.whatsapp_number) {
      toast({ title: 'Preencha nome e número do WhatsApp', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('lead_capture_forms').update({
        name: formData.name,
        whatsapp_number: formData.whatsapp_number,
        whatsapp_message: formData.whatsapp_message,
        redirect_to_whatsapp: formData.redirect_to_whatsapp,
      }).eq('id', editingForm.id);

      if (error) throw error;

      toast({ title: 'Formulário atualizado!' });
      setShowEditDialog(false);
      setEditingForm(null);
      resetFormData();
      fetchForms();
    } catch (error) {
      console.error('Error updating form:', error);
      toast({ title: 'Erro ao atualizar formulário', variant: 'destructive' });
    }
  };

  const toggleFormActive = async (form: LeadForm) => {
    try {
      const { error } = await supabase
        .from('lead_capture_forms')
        .update({ is_active: !form.is_active })
        .eq('id', form.id);

      if (error) throw error;
      toast({ title: form.is_active ? 'Formulário desativado' : 'Formulário ativado' });
      fetchForms();
    } catch (error) {
      console.error('Error toggling form:', error);
      toast({ title: 'Erro ao atualizar formulário', variant: 'destructive' });
    }
  };

  const deleteForm = async (id: string) => {
    try {
      const { error } = await supabase.from('lead_capture_forms').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Formulário removido' });
      fetchForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      toast({ title: 'Erro ao remover formulário', variant: 'destructive' });
    }
  };

  const generateEmbedCode = (form: LeadForm) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const formId = form.id.replace(/-/g, '_');
    const logoUrl = `${import.meta.env.VITE_APP_URL || 'https://legal-leaf-unifier-egknikizi.vercel.app'}/logo-eggnunes.png`;
    
    return `<!-- Formulário de Captura de Leads - ${form.name} -->
<!-- Compatível com WordPress/Elementor -->
<style>
  .lead-form-container-${formId} {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 420px;
    margin: 0 auto;
    padding: 28px 24px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    box-sizing: border-box;
  }
  .lead-form-container-${formId} * {
    box-sizing: border-box;
  }
  .lead-form-container-${formId} .lead-form-logo {
    display: block;
    max-width: 160px;
    height: auto;
    margin: 0 auto 16px;
  }
  .lead-form-container-${formId} .lead-form-header {
    text-align: center;
    margin-bottom: 20px;
  }
  .lead-form-container-${formId} .lead-form-header h3 {
    margin: 0 0 6px;
    font-size: 1.35rem;
    font-weight: 700;
    color: #1a1a1a;
  }
  .lead-form-container-${formId} .lead-form-header p {
    margin: 0;
    font-size: 14px;
    color: #666;
  }
  .lead-form-container-${formId} .form-group {
    margin-bottom: 16px;
  }
  .lead-form-container-${formId} label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    font-size: 14px;
    color: #333;
  }
  .lead-form-container-${formId} input {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid #e0e0e0;
    border-radius: 10px;
    font-size: 16px;
    box-sizing: border-box;
    background: #fafafa;
    color: #333;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .lead-form-container-${formId} input:focus {
    outline: none;
    border-color: #25D366;
    box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.15);
    background: #fff;
  }
  .lead-form-container-${formId} input::placeholder {
    color: #aaa;
  }
  .lead-form-container-${formId} button[type="submit"] {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
    margin-top: 4px;
  }
  .lead-form-container-${formId} button[type="submit"]:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4);
  }
  .lead-form-container-${formId} button[type="submit"]:active {
    transform: translateY(0);
  }
  .lead-form-container-${formId} button[type="submit"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .lead-form-container-${formId} .whatsapp-icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  .lead-form-container-${formId} .lead-form-footer {
    text-align: center;
    margin-top: 14px;
    font-size: 11px;
    color: #aaa;
  }
</style>

<div class="lead-form-container-${formId}" id="lead-container-${form.id}">
  <img src="${logoUrl}" alt="Egg Nunes Advogados" class="lead-form-logo" onerror="this.style.display='none'">
  <div class="lead-form-header">
    <h3>Fale Conosco Agora</h3>
    <p>Preencha os seus dados abaixo e clique no botão de WhatsApp</p>
  </div>
  <form id="lead-form-${form.id}" autocomplete="on">
    <div class="form-group">
      <label for="name-${form.id}">Nome *</label>
      <input type="text" id="name-${form.id}" name="name" required placeholder="Seu nome completo" autocomplete="name">
    </div>
    <div class="form-group">
      <label for="phone-${form.id}">Telefone *</label>
      <input type="tel" id="phone-${form.id}" name="phone" required placeholder="(00) 00000-0000" autocomplete="tel">
    </div>
    <div class="form-group">
      <label for="email-${form.id}">E-mail</label>
      <input type="email" id="email-${form.id}" name="email" placeholder="seu@email.com" autocomplete="email">
    </div>
    <input type="text" name="website_url" style="display:none !important;position:absolute;left:-9999px;" tabindex="-1" autocomplete="off">
    <button type="submit" id="submit-btn-${form.id}">
      <svg class="whatsapp-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Falar no WhatsApp
    </button>
  </form>
  <div class="lead-form-footer">Seus dados estão seguros conosco</div>
</div>

<script>
(function() {
  if (window['leadForm_${formId}_initialized']) return;
  
  var UTM_STORAGE_KEY = 'lead_form_utm_params';
  var UTM_LANDING_KEY = 'lead_form_landing_page';
  var UTM_REFERRER_KEY = 'lead_form_original_referrer';
  
  function getUtmParams() {
    var urlParams = new URLSearchParams(window.location.search);
    var utmParams = {
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign'),
      utm_content: urlParams.get('utm_content'),
      utm_term: urlParams.get('utm_term')
    };
    
    var hasUtmsInUrl = utmParams.utm_source || utmParams.utm_medium || utmParams.utm_campaign;
    
    if (hasUtmsInUrl) {
      try {
        sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams));
        sessionStorage.setItem(UTM_LANDING_KEY, window.location.href);
        if (document.referrer) {
          sessionStorage.setItem(UTM_REFERRER_KEY, document.referrer);
        }
      } catch (e) {
        console.log('UTM storage not available');
      }
      return utmParams;
    }
    
    try {
      var storedUtms = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (storedUtms) {
        return JSON.parse(storedUtms);
      }
    } catch (e) {
      console.log('Could not retrieve stored UTMs');
    }
    
    if (document.referrer) {
      try {
        var referrerUrl = new URL(document.referrer);
        var referrerParams = new URLSearchParams(referrerUrl.search);
        var referrerUtms = {
          utm_source: referrerParams.get('utm_source'),
          utm_medium: referrerParams.get('utm_medium'),
          utm_campaign: referrerParams.get('utm_campaign'),
          utm_content: referrerParams.get('utm_content'),
          utm_term: referrerParams.get('utm_term')
        };
        if (referrerUtms.utm_source || referrerUtms.utm_medium) {
          return referrerUtms;
        }
      } catch (e) {}
    }
    
    var autoSource = null;
    var autoMedium = null;
    if (document.referrer) {
      try {
        var refHost = new URL(document.referrer).hostname.toLowerCase();
        if (refHost.includes('google')) {
          autoSource = 'google';
          autoMedium = refHost.includes('ads') || refHost.includes('adwords') ? 'cpc' : 'organic';
        } else if (refHost.includes('facebook') || refHost.includes('fb.com') || refHost.includes('instagram')) {
          autoSource = 'facebook';
          autoMedium = 'referral';
        } else if (refHost.includes('bing')) {
          autoSource = 'bing';
          autoMedium = 'organic';
        } else if (refHost.includes('yahoo')) {
          autoSource = 'yahoo';
          autoMedium = 'organic';
        } else if (refHost.includes('linkedin')) {
          autoSource = 'linkedin';
          autoMedium = 'referral';
        } else if (refHost.includes('twitter') || refHost.includes('x.com')) {
          autoSource = 'twitter';
          autoMedium = 'referral';
        } else if (refHost.includes('youtube')) {
          autoSource = 'youtube';
          autoMedium = 'referral';
        } else if (refHost.includes('tiktok')) {
          autoSource = 'tiktok';
          autoMedium = 'referral';
        } else if (refHost && !refHost.includes(window.location.hostname)) {
          autoSource = refHost.replace('www.', '');
          autoMedium = 'referral';
        }
      } catch (e) {}
    }
    
    if (autoSource) {
      return {
        utm_source: autoSource,
        utm_medium: autoMedium,
        utm_campaign: null,
        utm_content: null,
        utm_term: null
      };
    }
    
    if (!document.referrer || document.referrer.includes(window.location.hostname)) {
      return {
        utm_source: 'direct',
        utm_medium: 'none',
        utm_campaign: null,
        utm_content: null,
        utm_term: null
      };
    }
    
    return utmParams;
  }
  
  function getOriginalLandingPage() {
    try {
      var stored = sessionStorage.getItem(UTM_LANDING_KEY);
      if (stored) return stored;
    } catch (e) {}
    return window.location.href;
  }
  
  function getOriginalReferrer() {
    try {
      var stored = sessionStorage.getItem(UTM_REFERRER_KEY);
      if (stored) return stored;
    } catch (e) {}
    return document.referrer || null;
  }
  
  function initLeadForm() {
    var form = document.getElementById('lead-form-${form.id}');
    var submitBtn = document.getElementById('submit-btn-${form.id}');
    var container = document.getElementById('lead-container-${form.id}');
    
    if (!form || !submitBtn || !container) {
      console.log('Lead form elements not found yet, retrying...');
      return false;
    }
    
    if (form.dataset.initialized === 'true') return true;
    form.dataset.initialized = 'true';
    window['leadForm_${formId}_initialized'] = true;
    
    var utmData = getUtmParams();
    
    function createWhatsAppIcon() {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'whatsapp-icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z');
      svg.appendChild(path);
      return svg;
    }
    
    function setButtonContent(btn, text, includeIcon) {
      while (btn.firstChild) btn.removeChild(btn.firstChild);
      if (includeIcon) {
        btn.appendChild(createWhatsAppIcon());
      }
      var textNode = document.createTextNode(text);
      btn.appendChild(textNode);
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      submitBtn.disabled = true;
      setButtonContent(submitBtn, 'Enviando...', false);
      
      var formDataObj = new FormData(form);
      var nameVal = (formDataObj.get('name') || '').toString().trim();
      var phoneVal = (formDataObj.get('phone') || '').toString().trim();
      var emailVal = (formDataObj.get('email') || '').toString().trim();
      
      if (!nameVal || nameVal.length < 2) {
        alert('Por favor, informe seu nome.');
        submitBtn.disabled = false;
        setButtonContent(submitBtn, 'Falar no WhatsApp', true);
        return;
      }
      
      if (!phoneVal || phoneVal.replace(/\\D/g, '').length < 10) {
        alert('Por favor, informe um telefone válido.');
        submitBtn.disabled = false;
        setButtonContent(submitBtn, 'Falar no WhatsApp', true);
        return;
      }
      
      var payload = {
        form_id: '${form.id}',
        name: nameVal,
        email: emailVal || null,
        phone: phoneVal,
        utm_source: utmData.utm_source,
        utm_medium: utmData.utm_medium,
        utm_campaign: utmData.utm_campaign,
        utm_content: utmData.utm_content,
        utm_term: utmData.utm_term,
        landing_page: getOriginalLandingPage(),
        referrer: getOriginalReferrer(),
        user_agent: navigator.userAgent,
        website_url: formDataObj.get('website_url') || ''
      };
      
      fetch('${supabaseUrl}/functions/v1/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(result) {
        if (result.error) {
          throw new Error(result.error);
        }
        
        if (result.whatsapp_url) {
          window.open(result.whatsapp_url, '_blank');
        }
        
        form.style.display = 'none';
        var headerEl = container.querySelector('.lead-form-header');
        if (headerEl) headerEl.style.display = 'none';
        var footerEl = container.querySelector('.lead-form-footer');
        if (footerEl) footerEl.style.display = 'none';
        
        var successDiv = document.createElement('div');
        successDiv.style.cssText = 'text-align: center; padding: 20px 0;';
        successDiv.innerHTML = '<div style="font-size: 48px; margin-bottom: 12px;">✓</div>' +
          '<h3 style="color: #25D366; margin: 0 0 8px; font-size: 1.25rem;">Enviado com sucesso!</h3>' +
          '<p style="color: #666; margin: 0; font-size: 14px;">Em breve entraremos em contato.</p>';
        container.appendChild(successDiv);
        
        setTimeout(function() {
          container.style.opacity = '0';
          container.style.transition = 'opacity 0.5s ease';
          setTimeout(function() {
            container.style.display = 'none';
          }, 500);
        }, 3000);
      })
      .catch(function(error) {
        console.error('Lead form error:', error);
        submitBtn.disabled = false;
        setButtonContent(submitBtn, 'Erro. Tente novamente.', false);
        
        setTimeout(function() {
          setButtonContent(submitBtn, 'Falar no WhatsApp', true);
        }, 3000);
      });
    });
    
    console.log('Lead form ${form.id} initialized successfully');
    return true;
  }
  
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!initLeadForm()) {
      var retryCount = 0;
      var maxRetries = 20;
      var retryInterval = setInterval(function() {
        retryCount++;
        if (initLeadForm() || retryCount >= maxRetries) {
          clearInterval(retryInterval);
          if (retryCount >= maxRetries) {
            console.warn('Lead form: max retries reached');
          }
        }
      }, 250);
    }
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (!initLeadForm()) {
        var retryCount = 0;
        var maxRetries = 20;
        var retryInterval = setInterval(function() {
          retryCount++;
          if (initLeadForm() || retryCount >= maxRetries) {
            clearInterval(retryInterval);
          }
        }, 250);
      }
    });
  }
  
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(function() {
      setTimeout(initLeadForm, 100);
    });
  }
  
  if (typeof jQuery !== 'undefined') {
    jQuery(window).on('elementor/frontend/init', function() {
      setTimeout(initLeadForm, 500);
    });
  }
})();
</script>`;
  };

  const copyEmbedCode = (form: LeadForm) => {
    const code = generateEmbedCode(form);
    navigator.clipboard.writeText(code);
    toast({ title: 'Código copiado!' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Formulários de Captura
            </CardTitle>
            <CardDescription>
              Crie formulários para incorporar em suas landing pages
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) resetFormData();
          }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Formulário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Formulário</DialogTitle>
              </DialogHeader>
              <FormFields formData={formData} setFormData={setFormData} />
              <Button onClick={createForm} className="w-full">
                Criar Formulário
              </Button>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setEditingForm(null);
              resetFormData();
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Formulário</DialogTitle>
              </DialogHeader>
              <FormFields formData={formData} setFormData={setFormData} />
              <Button onClick={updateForm} className="w-full">
                Salvar Alterações
              </Button>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : forms.length === 0 ? (
            <p className="text-muted-foreground">Nenhum formulário criado</p>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{form.name}</span>
                      <Badge variant={form.is_active ? 'default' : 'secondary'}>
                        {form.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      WhatsApp: {form.whatsapp_number}
                    </p>
                  </div>
                   <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(form)}
                      title="Editar formulário"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFormActive(form)}
                    >
                      {form.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedForm(form)}
                        >
                          <Code className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Formulário - {form.name}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Preview Visual */}
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold">Preview do Formulário</Label>
                            <div className="border rounded-lg p-4" style={{ background: '#fff' }}>
                              <div className="max-w-[380px] mx-auto p-7 rounded-2xl" style={{ background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
                                <img 
                                  src={logoEggnunes} 
                                  alt="Egg Nunes Advogados" 
                                  className="mx-auto mb-4 max-w-[160px] h-auto"
                                />
                                <div className="text-center mb-5">
                                  <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Fale Conosco Agora</h3>
                                  <p className="text-sm mt-1" style={{ color: '#666' }}>Preencha os seus dados abaixo e clique no botão de WhatsApp</p>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: '#333' }}>Nome *</label>
                                    <input 
                                      type="text" 
                                      placeholder="Seu nome completo"
                                      className="w-full px-3.5 py-3 rounded-[10px] text-sm focus:outline-none"
                                      style={{ border: '1.5px solid #e0e0e0', background: '#fafafa', color: '#333' }}
                                      disabled
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: '#333' }}>Telefone *</label>
                                    <input 
                                      type="tel" 
                                      placeholder="(00) 00000-0000"
                                      className="w-full px-3.5 py-3 rounded-[10px] text-sm focus:outline-none"
                                      style={{ border: '1.5px solid #e0e0e0', background: '#fafafa', color: '#333' }}
                                      disabled
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: '#333' }}>E-mail</label>
                                    <input 
                                      type="email" 
                                      placeholder="seu@email.com"
                                      className="w-full px-3.5 py-3 rounded-[10px] text-sm focus:outline-none"
                                      style={{ border: '1.5px solid #e0e0e0', background: '#fafafa', color: '#333' }}
                                      disabled
                                    />
                                  </div>
                                  <button 
                                    className="w-full py-3.5 font-semibold rounded-[10px] flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)', border: 'none' }}
                                    disabled
                                  >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    Falar no WhatsApp
                                  </button>
                                </div>
                                <p className="text-center mt-3.5 text-[11px]" style={{ color: '#aaa' }}>Seus dados estão seguros conosco</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                              Preview do formulário com logo e layout atualizado.
                            </p>
                          </div>

                          {/* Código Embed */}
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold">Código para Incorporar</Label>
                            <p className="text-xs text-muted-foreground">
                              Copie e cole no HTML da sua landing page.
                            </p>
                            <div className="relative">
                              <Textarea
                                readOnly
                                value={generateEmbedCode(form)}
                                className="font-mono text-xs h-[380px]"
                              />
                              <Button
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => copyEmbedCode(form)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o formulário "{form.name}"? 
                            Esta ação não pode ser desfeita e todos os leads associados a este formulário perderão a referência.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteForm(form.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Como Incorporar os Formulários no seu Site</CardTitle>
          <CardDescription>
            Siga os passos abaixo para adicionar o formulário de captura na sua landing page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 1: Crie o formulário</h4>
              <p className="text-sm text-muted-foreground">
                Clique em "Novo Formulário" acima, configure o número do WhatsApp e a mensagem que o lead enviará.
              </p>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 2: Copie o código de incorporação</h4>
              <p className="text-sm text-muted-foreground">
                Clique no ícone de código {"</>"} no formulário criado e copie todo o conteúdo (HTML + CSS + JavaScript).
              </p>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 3: Cole na sua landing page</h4>
              <p className="text-sm text-muted-foreground">
                Cole o código no local onde deseja que o formulário apareça. Funciona em qualquer site: WordPress, Wix, HTML puro, etc.
              </p>
              <div className="bg-muted p-3 rounded-lg text-xs font-mono">
                <p className="text-muted-foreground mb-2">Exemplo de onde colar no HTML:</p>
                <code>{`<body>`}</code><br />
                <code className="ml-4">{`<div id="secao-contato">`}</code><br />
                <code className="ml-8 text-primary">{`<!-- COLE O CÓDIGO DO FORMULÁRIO AQUI -->`}</code><br />
                <code className="ml-4">{`</div>`}</code><br />
                <code>{`</body>`}</code>
              </div>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 4: Configure os parâmetros UTM nos anúncios</h4>
              <p className="text-sm text-muted-foreground">
                Use os templates dinâmicos do Gerador de UTM. O formulário captura automaticamente os parâmetros da URL.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">O que acontece quando um lead preenche o formulário?</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Os dados do lead são salvos no banco de dados da intranet</li>
              <li>O lead é sincronizado automaticamente com o RD Station</li>
              <li>Se configurado, o WhatsApp abre com a mensagem pré-preenchida</li>
              <li>Você vê todos os dados no Dashboard de Leads, incluindo a origem (campanha, anúncio, etc.)</li>
            </ol>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Dica para WordPress
            </h4>
            <p className="text-sm text-muted-foreground">
              Use um bloco "HTML Personalizado" ou o plugin "Insert Headers and Footers" para adicionar o código. 
              Se estiver usando Elementor, use o widget "HTML".
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

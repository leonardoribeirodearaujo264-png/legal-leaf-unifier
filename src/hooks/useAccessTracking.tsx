import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Mapeamento de paths para nomes amigáveis
const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/assistente-ia': 'Assistente de IA',
  '/tools/rotadoc': 'RotaDoc',
  '/pesquisa-jurisprudencia': 'Pesquisa de Jurisprudência',
  '/agentes-ia': 'Agentes de IA',
  '/sugestoes': 'Sugestões',
  '/forum': 'Fórum',
  '/mural-avisos': 'Mural de Avisos',
  '/aniversarios': 'Aniversários',
  '/aniversarios-clientes': 'Aniversários de Clientes',
  '/equipe': 'Nossa Equipe',
  '/mensagens': 'Mensagens',
  '/home-office': 'Home Office',
  '/ferias': 'Férias',
  '/sala-reuniao': 'Sala de Reunião',
  '/copa-cozinha': 'Copa/Cozinha',
  '/contratacao': 'Contratação',
  '/galeria-eventos': 'Galeria de Eventos',
  '/sobre-escritorio': 'Sobre o Escritório',
  '/documentos-uteis': 'Documentos Úteis',
  '/financeiro': 'Financeiro',
  '/financeiro-admin': 'Financeiro Admin',
  '/relatorios-financeiros': 'Relatórios Financeiros',
  '/crm': 'CRM',
  '/setor-comercial': 'Setor Comercial',
  '/setor-comercial-dashboard': 'Dashboard Comercial',
  '/lead-tracking': 'Lead Tracking',
  '/processos': 'Processos',
  '/publicacoes-feed': 'Publicações',
  '/decisoes-favoraveis': 'Jurisprudência Interna',
  '/tarefas-advbox': 'Tarefas Advbox',
  '/advbox-config': 'Configuração Advbox',
  '/advbox-analytics': 'Analytics Advbox',
  '/historico': 'Histórico',
  '/cobranca': 'Cobrança',
  '/caixinha-desabafo': 'Caixinha do Desabafo',
  '/codigos-autenticacao': 'Códigos de Autenticação',
  '/integracoes': 'Integrações',
  '/profile': 'Perfil',
  '/admin': 'Painel Administrativo',
  '/notificacoes': 'Notificações',
  '/arquivos-teams': 'Arquivos Teams',
  '/solicitacoes-administrativas': 'Solicitações Administrativas',
  '/onboarding': 'Onboarding',
  '/relatorios-tarefas': 'Relatórios de Tarefas',
  '/historico-mensagens-aniversario': 'Histórico Mensagens Aniversário',
  '/mensagens-encaminhadas': 'Mensagens Encaminhadas',
  '/dashboard-sugestoes': 'Dashboard de Sugestões',
  '/contatos-advbox': 'Contatos ADVBox',
};

export function useAccessTracking() {
  const location = useLocation();

  useEffect(() => {
    const trackAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const path = location.pathname;
      const pageName = PAGE_NAMES[path] || path;

      // Ignorar paths que não são páginas principais
      if (path === '/' || path === '/auth' || path.startsWith('/forum/')) return;

      try {
        // Tentar buscar registro existente
        const { data: existing } = await supabase
          .from('user_access_tracking')
          .select('id, access_count')
          .eq('user_id', user.id)
          .eq('page_path', path)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('user_access_tracking')
            .update({
              access_count: existing.access_count + 1,
              last_accessed_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('user_access_tracking')
            .insert({
              user_id: user.id,
              page_path: path,
              page_name: pageName,
              access_count: 1
            });
        }
      } catch (error) {
        // Silently fail - não é crítico
        console.error('Erro ao rastrear acesso:', error);
      }
    };

    trackAccess();
  }, [location.pathname]);
}

export async function getTopAccessedPages(userId: string, limit: number = 6): Promise<Array<{ page_path: string; page_name: string; access_count: number }>> {
  const { data, error } = await supabase
    .from('user_access_tracking')
    .select('page_path, page_name, access_count')
    .eq('user_id', userId)
    .order('access_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar páginas mais acessadas:', error);
    return [];
  }

  return data || [];
}

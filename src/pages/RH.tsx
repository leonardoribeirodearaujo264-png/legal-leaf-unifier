import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, UserCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RHMenus } from '@/components/rh/RHMenus';
import { RHCargos, RHPagamentos, RHDashboard, RHColaboradores, RHColaboradorDashboard, RHAdiantamentos, RHPromocoes, RHFolgas } from '@/components/rh';
import { ColaboradorPerfilUnificado } from '@/components/rh/ColaboradorPerfilUnificado';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

export default function RH() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, profile, loading } = useUserRole();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const colaboradorId = searchParams.get('colaboradorId');
  const colaboradorTab = searchParams.get('tab') || 'dados';
  const isSocio = profile?.position === 'socio';
  const canAccess = isAdmin || isSocio;
  const isSelfProfile = colaboradorId && user && colaboradorId === user.id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não tem permissão (exceto se for o próprio perfil), redireciona
  if (!canAccess && !isSelfProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground mb-4">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
        </div>
      </div>
    );
  }

  // Se tem colaboradorId na URL, mostra o perfil unificado
  if (colaboradorId) {
    return (
      <div className="min-h-screen pb-16">
        {/* Header */}
        <div className="border-b bg-background sticky top-0 z-30">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/rh')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Perfil do Colaborador</h1>
                  <p className="text-sm text-muted-foreground">
                    Informações completas do colaborador
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="container mx-auto p-6">
          <ColaboradorPerfilUnificado colaboradorId={colaboradorId} initialTab={colaboradorTab} />
        </main>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <RHDashboard />;
      case 'colaborador-dashboard':
        return <RHColaboradorDashboard />;
      case 'pagamentos':
        return <RHPagamentos />;
      case 'adiantamentos':
        return <RHAdiantamentos />;
      case 'promocoes':
        return <RHPromocoes />;
      case 'folgas':
        return <RHFolgas />;
      case 'cargos':
        return <RHCargos />;
      case 'colaboradores':
        return <RHColaboradores />;
      default:
        return <RHDashboard />;
    }
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Recursos Humanos</h1>
                  <p className="text-sm text-muted-foreground">
                    Gestão de colaboradores e folha de pagamento
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout com menu lateral */}
      <div className="flex">
        {/* Menu Lateral */}
        <aside className="hidden lg:block sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <RHMenus activeTab={activeTab} onTabChange={setActiveTab} />
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 p-6">
          {/* Menu mobile/tablet */}
          <div className="lg:hidden mb-6">
            <select 
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            >
              <optgroup label="Visão Geral">
                <option value="dashboard">Pagamento Colaboradores</option>
                <option value="colaborador-dashboard">Dashboard Colaborador</option>
              </optgroup>
              <optgroup label="Folha de Pagamento">
                <option value="pagamentos">Folha de Pagamento</option>
                <option value="adiantamentos">Adiantamentos</option>
              </optgroup>
              <optgroup label="Gestão de Pessoas">
                <option value="promocoes">Promoções</option>
                <option value="folgas">Folgas</option>
              </optgroup>
              <optgroup label="Cadastros">
                <option value="colaboradores">Colaboradores</option>
                <option value="cargos">Cargos e Salários</option>
              </optgroup>
            </select>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}

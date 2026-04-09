import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ScrollRestoration } from "@/hooks/useScrollRestoration";
import { ThemeProvider } from "next-themes";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Historico from "./pages/Historico";
import RotaDoc from "./pages/RotaDoc";
import AgentesIA from "./pages/AgentesIA";
import AgenteChatPage from "./pages/AgenteChatPage";
import Sugestoes from "./pages/Sugestoes";
import DashboardSugestoes from "./pages/DashboardSugestoes";
import Forum from "./pages/Forum";
import ForumTopic from "./pages/ForumTopic";
import DocumentosUteis from "./pages/DocumentosUteis";
import Aniversarios from "./pages/Aniversarios";
import Profile from "./pages/Profile";
import Equipe from "./pages/Equipe";
import Onboarding from "./pages/Onboarding";
import MuralAvisos from "./pages/MuralAvisos";
import GaleriaEventos from "./pages/GaleriaEventos";
import NotFound from "./pages/NotFound";
import ProcessosDashboard from "./pages/ProcessosDashboard";
import AniversariosClientes from "./pages/AniversariosClientes";
import ContatosAdvbox from "./pages/ContatosAdvbox";
import PublicacoesFeed from "./pages/PublicacoesFeed";
import TarefasAdvbox from "./pages/TarefasAdvbox";
import ControlePrazos from "./pages/ControlePrazos";
import RelatoriosFinanceiros from "./pages/RelatoriosFinanceiros";
import AdvboxConfig from "./pages/AdvboxConfig";
import AdvboxAnalytics from "./pages/AdvboxAnalytics";
import MovimentacoesAdvbox from "./pages/MovimentacoesAdvbox";
import TraducaoAndamentos from "./pages/TraducaoAndamentos";
import ProcessosAtivos from "./pages/ProcessosAtivos";
// RelatoriosProdutividadeTarefas moved into TarefasAdvbox as a tab
import Ferias from "./pages/Ferias";
import SolicitacoesAdministrativas from "./pages/SolicitacoesAdministrativas";
// HistoricoMensagensAniversario moved into AniversariosClientes as a tab
import CollectionManagement from "./pages/CollectionManagement";
import CopaCozinha from "./pages/CopaCozinha";
import HomeOffice from "./pages/HomeOffice";
import Contratacao from "./pages/Contratacao";
import SalaReuniao from "./pages/SalaReuniao";
import PesquisaJurisprudencia from "./pages/PesquisaJurisprudencia";
import AssistenteIA from "./pages/AssistenteIA";
import SetorComercial from "./pages/SetorComercial";
import SetorComercialDashboard from "./pages/SetorComercialDashboard";
import Integracoes from "./pages/Integracoes";
import Notificacoes from "./pages/Notificacoes";
import LeadTracking from "./pages/LeadTracking";
import CRM from "./pages/CRM";
import CodigosAutenticacao from "./pages/CodigosAutenticacao";
import ArquivosTeams from "./pages/ArquivosTeams";
import CriarPastaCliente from "./pages/CriarPastaCliente";
import Mensagens from "./pages/Mensagens";
import CaixinhaDesabafo from "./pages/CaixinhaDesabafo";
import MensagensEncaminhadas from "./pages/MensagensEncaminhadas";
import DecisoesFavoraveis from "./pages/DecisoesFavoraveis";
import SobreEscritorio from "./pages/SobreEscritorio";
import Financeiro from "./pages/Financeiro";
import FinanceiroAdmin from "./pages/FinanceiroAdmin";
import GeradorQRCode from "./pages/GeradorQRCode";
import Parceiros from "./pages/Parceiros";
import Asaas from "./pages/Asaas";
import RH from "./pages/RH";
import PortaisTribunais from "./pages/PortaisTribunais";
import WhatsAppAvisos from "./pages/WhatsAppAvisos";
import CorretorPortugues from "./pages/CorretorPortugues";
import PublicacoesDJE from "./pages/PublicacoesDJE";
import ResetPassword from "./pages/ResetPassword";
import GestaoFolgas from "./pages/GestaoFolgas";
import CadastrosUteis from "./pages/CadastrosUteis";
import TVMode from "./pages/TVMode";
import MarketingHub from "./pages/MarketingHub";
import Viabilidade from "./pages/Viabilidade";
import ViabilidadeNovo from "./pages/ViabilidadeNovo";
import PesquisaHumor from "./pages/PesquisaHumor";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DistribuicaoTarefas from "./pages/DistribuicaoTarefas";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Desabilitar refetch automático ao focar na janela
      refetchOnWindowFocus: false,
      // Desabilitar refetch ao reconectar
      refetchOnReconnect: false,
      // Manter dados em cache por mais tempo
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ScrollRestoration />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historico"
              element={
                <ProtectedRoute>
                  <Historico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/rotadoc"
              element={
                <ProtectedRoute>
                  <RotaDoc />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agentes-ia"
              element={
                <ProtectedRoute>
                  <AgentesIA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agentes-ia/:agentId"
              element={
                <ProtectedRoute>
                  <AgenteChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sugestoes"
              element={
                <ProtectedRoute>
                  <Sugestoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-sugestoes"
              element={
                <ProtectedRoute>
                  <DashboardSugestoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forum"
              element={
                <ProtectedRoute>
                  <Forum />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forum/:id"
              element={
                <ProtectedRoute>
                  <ForumTopic />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documentos-uteis"
              element={
                <ProtectedRoute>
                  <DocumentosUteis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aniversarios"
              element={
                <ProtectedRoute>
                  <Aniversarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipe"
              element={
                <ProtectedRoute>
                  <Equipe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mural-avisos"
              element={
                <ProtectedRoute>
                  <MuralAvisos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/galeria-eventos"
              element={
                <ProtectedRoute>
                  <GaleriaEventos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/processos"
              element={
                <ProtectedRoute>
                  <ProcessosDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/processos-ativos"
              element={
                <ProtectedRoute>
                  <ProcessosAtivos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contatos-advbox"
              element={
                <ProtectedRoute>
                  <ContatosAdvbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aniversarios-clientes"
              element={
                <ProtectedRoute>
                  <Navigate to="/contatos-advbox?tab=aniversarios" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/publicacoes"
              element={
                <ProtectedRoute>
                  <PublicacoesFeed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tarefas-advbox"
              element={
                <ProtectedRoute>
                  <TarefasAdvbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/distribuicao-tarefas"
              element={
                <ProtectedRoute>
                  <DistribuicaoTarefas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/controle-prazos"
              element={
                <ProtectedRoute>
                  <ControlePrazos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios-financeiros"
              element={
                <ProtectedRoute>
                  <RelatoriosFinanceiros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advbox-analytics"
              element={
                <ProtectedRoute>
                  <Navigate to="/processos" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movimentacoes-advbox"
              element={
                <ProtectedRoute>
                  <MovimentacoesAdvbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/traducao-andamentos"
              element={
                <ProtectedRoute>
                  <TraducaoAndamentos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios-produtividade-tarefas"
              element={
                <ProtectedRoute>
                  <Navigate to="/tarefas-advbox?tab=produtividade" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ferias"
              element={
                <ProtectedRoute>
                  <Ferias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/solicitacoes-administrativas"
              element={
                <ProtectedRoute>
                  <SolicitacoesAdministrativas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historico-mensagens-aniversario"
              element={
                <ProtectedRoute>
                  <Navigate to="/aniversarios-clientes?tab=historico" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-cobrancas"
              element={
                <ProtectedRoute>
                  <CollectionManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/copa-cozinha"
              element={
                <ProtectedRoute>
                  <CopaCozinha />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home-office"
              element={
                <ProtectedRoute>
                  <HomeOffice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contratacao"
              element={
                <ProtectedRoute>
                  <Contratacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sala-reuniao"
              element={
                <ProtectedRoute>
                  <SalaReuniao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pesquisa-jurisprudencia"
              element={
                <ProtectedRoute>
                  <PesquisaJurisprudencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistente-ia"
              element={
                <ProtectedRoute>
                  <AssistenteIA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/setor-comercial"
              element={
                <ProtectedRoute>
                  <SetorComercialDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/setor-comercial/contratos"
              element={
                <ProtectedRoute>
                  <SetorComercial />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integracoes"
              element={
                <ProtectedRoute>
                  <Integracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notificacoes"
              element={
                <ProtectedRoute>
                  <Notificacoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lead-tracking"
              element={
                <ProtectedRoute>
                  <LeadTracking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm"
              element={
                <ProtectedRoute>
                  <CRM />
                </ProtectedRoute>
              }
            />
            <Route
              path="/codigos-autenticacao"
              element={
                <ProtectedRoute>
                  <CodigosAutenticacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/arquivos-teams"
              element={
                <ProtectedRoute>
                  <ArquivosTeams />
                </ProtectedRoute>
              }
            />
            <Route
              path="/criar-pasta-cliente"
              element={
                <ProtectedRoute>
                  <CriarPastaCliente />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mensagens"
              element={
                <ProtectedRoute>
                  <Mensagens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caixinha-desabafo"
              element={
                <ProtectedRoute>
                  <CaixinhaDesabafo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mensagens-encaminhadas"
              element={
                <ProtectedRoute>
                  <MensagensEncaminhadas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/decisoes-favoraveis"
              element={
                <ProtectedRoute>
                  <DecisoesFavoraveis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sobre-escritorio"
              element={
                <ProtectedRoute>
                  <SobreEscritorio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute>
                  <Financeiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/admin"
              element={
                <ProtectedRoute>
                  <FinanceiroAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerador-qrcode"
              element={
                <ProtectedRoute>
                  <GeradorQRCode />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parceiros"
              element={
                <ProtectedRoute>
                  <Parceiros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/asaas"
              element={
                <ProtectedRoute>
                  <Asaas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh"
              element={
                <ProtectedRoute>
                  <RH />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portais-tribunais"
              element={
                <ProtectedRoute>
                  <PortaisTribunais />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp-avisos"
              element={
                <ProtectedRoute>
                  <WhatsAppAvisos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/corretor-portugues"
              element={
                <ProtectedRoute>
                  <CorretorPortugues />
                </ProtectedRoute>
              }
            />
            <Route
              path="/publicacoes-dje"
              element={
                <ProtectedRoute>
                  <PublicacoesDJE />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-folgas"
              element={
                <ProtectedRoute>
                  <GestaoFolgas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastros-uteis"
              element={
                <ProtectedRoute>
                  <CadastrosUteis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/negocios/tv"
              element={
                <ProtectedRoute>
                  <TVMode />
                </ProtectedRoute>
              }
            />
            <Route
              path="/negocios/marketing"
              element={
                <ProtectedRoute>
                  <MarketingHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/viabilidade"
              element={
                <ProtectedRoute>
                  <Viabilidade />
                </ProtectedRoute>
              }
            />
            <Route
              path="/viabilidade/novo"
              element={
                <ProtectedRoute>
                  <ViabilidadeNovo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pesquisa-humor"
              element={
                <ProtectedRoute>
                  <PesquisaHumor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advbox-config"
              element={
                <ProtectedRoute>
                  <AdvboxConfig />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

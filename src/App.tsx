import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ScrollRestoration } from "@/hooks/useScrollRestoration";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Dashboard from "./pages/Dashboard";
import Historico from "./pages/Historico";
import AssistenteIA from "./pages/AssistenteIA";
import AgentesIA from "./pages/AgentesIA";
import AgenteChatPage from "./pages/AgenteChatPage";
import Especialistas from "./pages/Especialistas";
import CorretorPortugues from "./pages/CorretorPortugues";
import Casos from "./pages/Casos";
import CaseDetail from "./pages/CaseDetail";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import ControlePrazos from "./pages/ControlePrazos";
import PesquisaJurisprudencia from "./pages/PesquisaJurisprudencia";
import ProcessosDashboard from "./pages/ProcessosDashboard";
import CRM from "./pages/CRM";
import RotaDoc from "./pages/RotaDoc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
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
                path="/historico"
                element={
                  <ProtectedRoute>
                    <Historico />
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
                path="/especialistas"
                element={
                  <ProtectedRoute>
                    <Especialistas />
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
                path="/casos"
                element={
                  <ProtectedRoute>
                    <Casos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/casos/:id"
                element={
                  <ProtectedRoute>
                    <CaseDetail />
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
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />
              <Route
                path="/controle-prazos"
                element={<ProtectedRoute><ControlePrazos /></ProtectedRoute>}
              />
              <Route
                path="/pesquisa-jurisprudencia"
                element={<ProtectedRoute><PesquisaJurisprudencia /></ProtectedRoute>}
              />
              <Route
                path="/processos-dashboard"
                element={<ProtectedRoute><ProcessosDashboard /></ProtectedRoute>}
              />
              <Route
                path="/crm"
                element={<ProtectedRoute><CRM /></ProtectedRoute>}
              />
              <Route
                path="/rota-doc"
                element={<ProtectedRoute><RotaDoc /></ProtectedRoute>}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

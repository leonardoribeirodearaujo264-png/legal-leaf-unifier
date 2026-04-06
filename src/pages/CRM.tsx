import { CRMDashboard } from "@/components/crm";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useNavigate } from "react-router-dom";
import { Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const CRM = () => {
  const { hasPermission, loading } = useAdminPermissions();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const canAccess = hasPermission('lead_tracking', 'view');

  if (!canAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <Users className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para acessar o CRM.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur-sm bg-card/95">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <span className="font-semibold text-sm">CRM</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Full-width CRM content */}
      <main className="flex-1 p-4 overflow-auto">
        <CRMDashboard />
      </main>
    </div>
  );
};

export default CRM;

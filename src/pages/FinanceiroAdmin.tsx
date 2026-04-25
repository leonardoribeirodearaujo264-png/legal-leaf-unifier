import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinanceiroAdminMenus } from '@/components/financeiro/FinanceiroMenus';
import { FinanceiroCategoriasAdmin } from '@/components/financeiro/FinanceiroCategoriasAdmin';
import { FinanceiroContasAdmin } from '@/components/financeiro/FinanceiroContasAdmin';
import { FinanceiroClientesAdmin } from '@/components/financeiro/FinanceiroClientesAdmin';
import { FinanceiroSetoresAdmin } from '@/components/financeiro/FinanceiroSetoresAdmin';
import { FinanceiroAuditoria } from '@/components/financeiro/FinanceiroAuditoria';
import { FinanceiroMetas } from '@/components/financeiro/FinanceiroMetas';
import { FinanceiroOrcamento } from '@/components/financeiro/FinanceiroOrcamento';
import { FinanceiroIndices } from '@/components/financeiro/FinanceiroIndices';
import { FinanceiroRelatorios } from '@/components/financeiro/FinanceiroRelatorios';
import { FinanceiroPrevisoes } from '@/components/financeiro/FinanceiroPrevisoes';
import { FinanceiroRankingClientes } from '@/components/financeiro/FinanceiroRankingClientes';
import { FinanceiroContratos } from '@/components/financeiro/FinanceiroContratos';
import { RelatorioSaudeFinanceira, RelatorioMargemCliente, RelatorioConformidade } from '@/components/financeiro/RelatoriosAvancados';
import { AlertasAnomalias } from '@/components/financeiro/AlertasAnomalias';
import { DiagnosticoAdvbox } from '@/components/financeiro/DiagnosticoAdvbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FinanceiroAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('contratos');

  const renderContent = () => {
    switch (activeTab) {
      case 'contratos':
        return <FinanceiroContratos />;
      case 'ranking':
        return <FinanceiroRankingClientes />;
      case 'metas':
        return <FinanceiroMetas />;
      case 'orcamento':
        return <FinanceiroOrcamento />;
      case 'indices':
        return <FinanceiroIndices />;
      case 'previsoes':
        return <FinanceiroPrevisoes />;
      case 'relatorios':
        return (
          <Tabs defaultValue="geral" className="space-y-4">
            <TabsList>
              <TabsTrigger value="geral">Relatórios Gerais</TabsTrigger>
              <TabsTrigger value="saude">Saúde Financeira</TabsTrigger>
              <TabsTrigger value="margem">Margem por Cliente</TabsTrigger>
              <TabsTrigger value="conformidade">Conformidade</TabsTrigger>
              <TabsTrigger value="anomalias">Anomalias</TabsTrigger>
            </TabsList>
            <TabsContent value="geral"><FinanceiroRelatorios /></TabsContent>
            <TabsContent value="saude"><RelatorioSaudeFinanceira /></TabsContent>
            <TabsContent value="margem"><RelatorioMargemCliente /></TabsContent>
            <TabsContent value="conformidade"><RelatorioConformidade /></TabsContent>
            <TabsContent value="anomalias"><AlertasAnomalias /></TabsContent>
          </Tabs>
        );
      case 'categorias':
        return <FinanceiroCategoriasAdmin />;
      case 'contas':
        return <FinanceiroContasAdmin />;
      case 'clientes':
        return <FinanceiroClientesAdmin />;
      case 'setores':
        return <FinanceiroSetoresAdmin />;
      case 'auditoria':
        return <FinanceiroAuditoria />;
      case 'diagnostico-advbox':
        return <DiagnosticoAdvbox />;
      default:
        return <FinanceiroContratos />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/financeiro')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Administração Financeira</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie categorias, contas, metas, orçamentos e análises
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Layout com menu lateral */}
      <div className="flex">
        {/* Menu Lateral */}
        <aside className="hidden lg:block sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <FinanceiroAdminMenus activeTab={activeTab} onTabChange={setActiveTab} />
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
              <optgroup label="Contratos & Vendas">
                <option value="contratos">Contratos</option>
                <option value="ranking">Ranking Clientes</option>
              </optgroup>
              <optgroup label="Metas & Orçamento">
                <option value="metas">Metas</option>
                <option value="orcamento">Orçamento</option>
                <option value="indices">Índices</option>
              </optgroup>
              <optgroup label="Análises">
                <option value="previsoes">Previsões IA</option>
                <option value="relatorios">Relatórios</option>
              </optgroup>
              <optgroup label="Cadastros">
                <option value="categorias">Categorias</option>
                <option value="contas">Contas Bancárias</option>
                <option value="clientes">Clientes</option>
                <option value="setores">Setores</option>
              </optgroup>
              <optgroup label="ADVBox">
                <option value="diagnostico-advbox">Diagnóstico ADVBox</option>
              </optgroup>
              <option value="auditoria">Auditoria</option>
            </select>
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}

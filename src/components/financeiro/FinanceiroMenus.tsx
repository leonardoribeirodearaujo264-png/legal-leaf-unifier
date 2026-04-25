import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Calculator,
  Target,
  RefreshCw,
  CheckSquare,
  Upload,
  Scale,
  Bell,
  FileText,
  Brain,
  Users,
  Building2,
  Wallet,
  Settings,
  FolderOpen,
  ClipboardList,
  PieChart,
  Landmark,
  FileCheck,
  UserCheck,
  Layers,
  Banknote
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: { id: string; label: string }[];
}

interface FinanceiroMenusProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems: MenuItem[] = [
  {
    id: 'visao-geral',
    label: 'Visão Geral',
    icon: BarChart3,
    items: [
      { id: 'dashboard', label: 'Dashboard Executivo' },
      { id: 'fluxo', label: 'Fluxo de Caixa' },
      { id: 'previsoes', label: 'Previsões IA' },
      { id: 'diagnostico-advbox', label: 'Diagnóstico ADVBox' },
    ]
  },
  {
    id: 'movimentacoes',
    label: 'Movimentações',
    icon: Wallet,
    items: [
      { id: 'lancamentos', label: 'Lançamentos' },
      { id: 'recorrencias', label: 'Recorrências' },
      { id: 'reembolsos', label: 'Reembolsos' },
      { id: 'aprovacoes', label: 'Aprovações' },
    ]
  },
  {
    id: 'analises',
    label: 'Análises',
    icon: PieChart,
    items: [
      { id: 'clientes', label: 'Por Cliente' },
      { id: 'setores', label: 'Por Setor' },
      { id: 'relatorios', label: 'Relatórios' },
    ]
  },
  {
    id: 'planejamento',
    label: 'Planejamento',
    icon: Target,
    items: [
      { id: 'metas', label: 'Metas' },
      { id: 'orcamento', label: 'Orçamento' },
    ]
  },
  {
    id: 'operacoes',
    label: 'Operações',
    icon: Settings,
    items: [
      { id: 'importacao', label: 'Importar Extrato' },
      { id: 'conciliacao', label: 'Conciliação' },
      { id: 'sync-advbox', label: 'Sincronizar ADVBox' },
    ]
  },
  {
    id: 'alertas',
    label: 'Alertas',
    icon: Bell,
  },
];

export function FinanceiroMenus({ activeTab, onTabChange }: FinanceiroMenusProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set(['visao-geral', 'movimentacoes']));

  const toggleMenu = (id: string) => {
    const newOpen = new Set(openMenus);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenMenus(newOpen);
  };

  const isActive = (id: string) => activeTab === id;
  const hasActiveChild = (menu: MenuItem) => 
    menu.items?.some(item => isActive(item.id)) || false;

  return (
    <div className="w-64 border-r bg-muted/30 p-4 space-y-1 min-h-[600px]">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 px-2">MENU FINANCEIRO</h3>
      
      {menuItems.map((menu) => (
        <div key={menu.id}>
          {menu.items ? (
            <Collapsible 
              open={openMenus.has(menu.id)} 
              onOpenChange={() => toggleMenu(menu.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between",
                    hasActiveChild(menu) && "bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <menu.icon className="h-4 w-4" />
                    {menu.label}
                  </span>
                  {openMenus.has(menu.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 space-y-1 mt-1">
                {menu.items.map((item) => (
                  <Button
                    key={item.id}
                    variant={isActive(item.id) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start text-sm",
                      isActive(item.id) && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => onTabChange(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Button
              variant={isActive(menu.id) ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive(menu.id) && "bg-primary text-primary-foreground"
              )}
              onClick={() => onTabChange(menu.id)}
            >
              <menu.icon className="h-4 w-4 mr-2" />
              {menu.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// Menu para a página de administração
const adminMenuItems: MenuItem[] = [
  {
    id: 'contratos-vendas',
    label: 'Contratos & Vendas',
    icon: FileCheck,
    items: [
      { id: 'contratos', label: 'Contratos' },
      { id: 'ranking', label: 'Ranking Clientes' },
    ]
  },
  {
    id: 'metas-orcamento',
    label: 'Metas & Orçamento',
    icon: Target,
    items: [
      { id: 'metas', label: 'Metas' },
      { id: 'orcamento', label: 'Orçamento' },
      { id: 'indices', label: 'Índices' },
    ]
  },
  {
    id: 'analises-admin',
    label: 'Análises',
    icon: Brain,
    items: [
      { id: 'previsoes', label: 'Previsões IA' },
      { id: 'relatorios', label: 'Relatórios' },
    ]
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: FolderOpen,
    items: [
      { id: 'categorias', label: 'Categorias' },
      { id: 'contas', label: 'Contas Bancárias' },
      { id: 'clientes', label: 'Clientes' },
      { id: 'setores', label: 'Setores' },
    ]
  },
  {
    id: 'auditoria',
    label: 'Auditoria',
    icon: ClipboardList,
  },
];

interface FinanceiroAdminMenusProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function FinanceiroAdminMenus({ activeTab, onTabChange }: FinanceiroAdminMenusProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set(['contratos-vendas', 'cadastros']));

  const toggleMenu = (id: string) => {
    const newOpen = new Set(openMenus);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenMenus(newOpen);
  };

  const isActive = (id: string) => activeTab === id;
  const hasActiveChild = (menu: MenuItem) => 
    menu.items?.some(item => isActive(item.id)) || false;

  return (
    <div className="w-64 border-r bg-muted/30 p-4 space-y-1 min-h-[600px]">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 px-2">ADMINISTRAÇÃO</h3>
      
      {adminMenuItems.map((menu) => (
        <div key={menu.id}>
          {menu.items ? (
            <Collapsible 
              open={openMenus.has(menu.id)} 
              onOpenChange={() => toggleMenu(menu.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between",
                    hasActiveChild(menu) && "bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <menu.icon className="h-4 w-4" />
                    {menu.label}
                  </span>
                  {openMenus.has(menu.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 space-y-1 mt-1">
                {menu.items.map((item) => (
                  <Button
                    key={item.id}
                    variant={isActive(item.id) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start text-sm",
                      isActive(item.id) && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => onTabChange(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Button
              variant={isActive(menu.id) ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive(menu.id) && "bg-primary text-primary-foreground"
              )}
              onClick={() => onTabChange(menu.id)}
            >
              <menu.icon className="h-4 w-4 mr-2" />
              {menu.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

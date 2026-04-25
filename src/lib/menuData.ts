import {
  Home,
  Briefcase,
  Scale,
  DollarSign,
  Users,
  User,
  Search as SearchIcon,
  MessageSquare,
  Sparkles,
  Settings,
  BarChart3,
  TrendingUp,
  Tv,
  Target,
  FileSignature,
  Megaphone,
  FileText,
  CheckSquare,
  AlertCircle,
  Gavel,
  BookOpen,
  Award,
  Bell,
  ClipboardList,
  Wallet,
  CreditCard,
  Cake,
  SmilePlus,
  CalendarDays,
  UserPlus,
  UserCircle,
  FolderOpen,
  MessageCircle,
  Lightbulb,
  HeartHandshake,
  Building2,
  History,
  Camera,
  Phone,
  Shield,
  KeyRound,
  HardDrive,
  Handshake,
  Coffee,
  DoorOpen,
  Bot,
  SpellCheck,
  Link2,
  LinkIcon,
  Languages,
} from 'lucide-react';

export interface MenuItemDef {
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  label: string;
  searchDescription?: string;
  badgeCount?: number;
  condition?: boolean;
}

export interface MenuGroupDef {
  id: string;
  label: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItemDef[];
}

interface MenuCounts {
  criticalTasksCount?: number;
  pendingUsersCount?: number;
  unreadMessagesCount?: number;
}

export function getMenuGroups(
  isAdmin: boolean,
  isSocio: boolean,
  counts: MenuCounts = {}
): MenuGroupDef[] {
  const { criticalTasksCount = 0, pendingUsersCount = 0, unreadMessagesCount = 0 } = counts;

  return [
    {
      id: 'dashboard',
      label: 'Dashboard & Visão Geral',
      emoji: '📊',
      icon: Home,
      items: [
        { icon: BarChart3, path: '/dashboard', label: 'Dashboard Principal', searchDescription: 'Página inicial com métricas' },
        { icon: History, path: '/historico', label: 'Histórico', searchDescription: 'Histórico de uso' },
      ],
    },
    {
      id: 'ferramentas',
      label: 'Ferramentas & IA',
      emoji: '🤖',
      icon: Sparkles,
      items: [
        { icon: Bot, path: '/assistente-ia', label: 'Assistente de IA', searchDescription: 'Chat com inteligência artificial' },
        { icon: Sparkles, path: '/agentes-ia', label: 'Agentes de IA', searchDescription: 'Agentes especializados de IA' },
        { icon: FileText, path: '/tools/rotadoc', label: 'RotaDoc', searchDescription: 'Organização de documentos com IA' },
        { icon: LinkIcon, path: '/integracoes', label: 'Integrações', searchDescription: 'Webhooks e APIs' },
        { icon: SpellCheck, path: '/corretor-portugues', label: 'Corretor de Português', searchDescription: 'Correção ortográfica e gramatical' },
        { icon: Link2, path: '/gerador-qrcode', label: 'Gerador de QR Code', searchDescription: 'Criar QR codes personalizados' },
      ],
    },
    {
      id: 'negocios',
      label: 'Negócios & CRM',
      emoji: '💼',
      icon: Briefcase,
      items: [
        { icon: Users, path: '/crm', label: 'CRM Principal', searchDescription: 'Gestão de leads e clientes' },
        { icon: Tv, path: '/negocios/tv', label: 'TV Mode', searchDescription: 'Modo TV para acompanhamento' },
        { icon: Briefcase, path: '/setor-comercial', label: 'Setor Comercial', searchDescription: 'Painel comercial e documentos' },
        { icon: Target, path: '/lead-tracking', label: 'Lead Tracking', searchDescription: 'UTMs e formulários de captação', condition: isSocio || isAdmin },
        { icon: TrendingUp, path: '/negocios/marketing', label: 'Marketing Hub', searchDescription: 'Campanhas e anúncios' },
        { icon: FileSignature, path: '/setor-comercial/contratos', label: 'Contratos', searchDescription: 'Gestão de contratos' },
        { icon: Handshake, path: '/parceiros', label: 'Parceiros', searchDescription: 'Gestão de parceiros e indicações' },
      ],
    },
    {
      id: 'producao-juridica',
      label: 'Produção Jurídica',
      emoji: '⚖️',
      icon: Scale,
      items: [
        { icon: Briefcase, path: '/processos', label: 'Processos Dashboard', searchDescription: 'Dashboard de processos jurídicos' },
        { icon: BarChart3, path: '/business-intelligence', label: 'Business Intelligence', searchDescription: 'BI espelho do ADVBox managementV2 com produtividade, estoque, tempo, custos e safra' },
        { icon: CheckSquare, path: '/tarefas-advbox', label: 'Tarefas Advbox', searchDescription: 'Gestão de tarefas do Advbox', badgeCount: criticalTasksCount },
        { icon: Users, path: '/distribuicao-tarefas', label: 'Distribuição de Tarefas', searchDescription: 'Distribuir tarefas entre equipe', condition: isSocio || isAdmin },
        { icon: ClipboardList, path: '/controle-prazos', label: 'Controle de Prazos', searchDescription: 'Monitorar prazos processuais', condition: isSocio || isAdmin },
        { icon: Briefcase, path: '/processos-ativos', label: 'Processos Ativos', searchDescription: 'Lista de processos em andamento' },
        { icon: AlertCircle, path: '/movimentacoes-advbox', label: 'Movimentações Advbox', searchDescription: 'Movimentações processuais' },
        { icon: Languages, path: '/traducao-andamentos', label: 'Tradução de Andamentos', searchDescription: 'Traduzir andamentos para linguagem simples' },
        { icon: Bell, path: '/publicacoes', label: 'Publicações ADVBox', searchDescription: 'Feed de publicações do Advbox' },
        { icon: Users, path: '/contatos-advbox', label: 'Contatos ADVBox', searchDescription: 'Contatos clientes aniversários ADVBox' },
        { icon: SearchIcon, path: '/pesquisa-jurisprudencia', label: 'Pesquisa Jurisprudência', searchDescription: 'Busca em jurisprudência' },
        { icon: FileText, path: '/publicacoes-dje', label: 'Publicações DJE', searchDescription: 'Diário de Justiça Eletrônico' },
        { icon: Gavel, path: '/portais-tribunais', label: 'Portais de Tribunais', searchDescription: 'Acesso rápido a tribunais' },
        { icon: Award, path: '/decisoes-favoraveis', label: 'Jurisprudência Interna', searchDescription: 'Registro de decisões e jurimetria' },
        { icon: KeyRound, path: '/codigos-autenticacao', label: 'Códigos TOTP', searchDescription: 'Autenticação de tribunais' },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      emoji: '💰',
      icon: DollarSign,
      items: [
        { icon: Wallet, path: '/financeiro', label: 'Dashboard Financeiro', searchDescription: 'Painel financeiro geral' },
        { icon: CreditCard, path: '/asaas', label: 'Asaas', searchDescription: 'Cobranças e pagamentos Asaas' },
        { icon: BarChart3, path: '/relatorios-financeiros', label: 'Relatórios Financeiros', searchDescription: 'Relatórios e métricas financeiras' },
        { icon: DollarSign, path: '/gestao-cobrancas', label: 'Gestão de Cobranças', searchDescription: 'Régua de cobrança automática' },
        { icon: Settings, path: '/financeiro/admin', label: 'Financeiro Admin', searchDescription: 'Administração financeira', condition: isSocio || isAdmin },
      ],
    },
    {
      id: 'rh',
      label: 'RH & Administrativo',
      emoji: '👥',
      icon: Users,
      items: [
        { icon: BarChart3, path: '/rh', label: 'Pagamento Colaboradores', searchDescription: 'Pagamento de colaboradores recursos humanos', condition: isSocio || isAdmin },
        { icon: Users, path: '/equipe', label: 'Equipe', searchDescription: 'Membros da equipe' },
        { icon: Cake, path: '/aniversarios', label: 'Aniversários', searchDescription: 'Aniversários da equipe' },
        { icon: SmilePlus, path: '/pesquisa-humor', label: 'Pesquisa de Humor', searchDescription: 'Clima organizacional' },
        { icon: Megaphone, path: '/mural-avisos', label: 'Mural de Avisos', searchDescription: 'Comunicados e eventos' },
        { icon: CalendarDays, path: '/ferias', label: 'Férias', searchDescription: 'Gestão de férias' },
        { icon: CalendarDays, path: '/gestao-folgas', label: 'Gestão de Folgas', searchDescription: 'Escala de folgas' },
        { icon: UserPlus, path: '/contratacao', label: 'Contratação', searchDescription: 'Recrutamento e currículos' },
        { icon: Home, path: '/home-office', label: 'Home Office', searchDescription: 'Escala de home office' },
        { icon: BookOpen, path: '/onboarding', label: 'Onboarding', searchDescription: 'Materiais de integração' },
        { icon: Camera, path: '/galeria-eventos', label: 'Galeria de Eventos', searchDescription: 'Fotos dos eventos' },
        { icon: Coffee, path: '/copa-cozinha', label: 'Copa/Cozinha', searchDescription: 'Sugestões de alimentos' },
      ],
    },
    {
      id: 'meu-painel',
      label: 'Meu Painel',
      emoji: '👤',
      icon: User,
      items: [
        { icon: UserCircle, path: '/profile', label: 'Meu Perfil', searchDescription: 'Editar perfil' },
        { icon: ClipboardList, path: '/solicitacoes-administrativas', label: 'Solicitações', searchDescription: 'Pedidos administrativos' },
        { icon: Building2, path: '/sobre-escritorio', label: 'Sobre o Escritório', searchDescription: 'História e áreas de atuação' },
        { icon: DoorOpen, path: '/sala-reuniao', label: 'Sala de Reunião', searchDescription: 'Reservar sala de reunião' },
      ],
    },
    {
      id: 'arquivos',
      label: 'Arquivos do Escritório',
      emoji: '📁',
      icon: FolderOpen,
      items: [
        { icon: HardDrive, path: '/arquivos-teams', label: 'Arquivos Teams', searchDescription: 'Microsoft Teams' },
        { icon: UserPlus, path: '/criar-pasta-cliente', label: 'Criar Pasta de Cliente', searchDescription: 'Nova pasta no Teams' },
      ],
    },
    {
      id: 'viabilidade',
      label: 'Viabilidade Jurídica',
      emoji: '🔍',
      icon: SearchIcon,
      items: [
        { icon: SearchIcon, path: '/viabilidade', label: 'Dashboard Viabilidade', searchDescription: 'Análise de viabilidade jurídica' },
        { icon: UserPlus, path: '/viabilidade/novo', label: 'Novo Cliente', searchDescription: 'Cadastrar novo caso de viabilidade' },
      ],
    },
    {
      id: 'comunicacao',
      label: 'Comunicação e Avisos',
      emoji: '📢',
      icon: MessageSquare,
      items: [
        { icon: FolderOpen, path: '/documentos-uteis', label: 'Documentos Úteis', searchDescription: 'Documentos internos' },
        { icon: Bell, path: '/notificacoes', label: 'Notificações', searchDescription: 'Central de notificações' },
        { icon: MessageSquare, path: '/forum', label: 'Fórum', searchDescription: 'Discussões da equipe' },
        { icon: MessageCircle, path: '/mensagens', label: 'Mensagens', searchDescription: 'Chat com a equipe', badgeCount: unreadMessagesCount },
        { icon: Lightbulb, path: '/sugestoes', label: 'Sugestões', searchDescription: 'Envie suas ideias' },
        { icon: BarChart3, path: '/dashboard-sugestoes', label: 'Dashboard Sugestões', searchDescription: 'Estatísticas de sugestões' },
        { icon: HeartHandshake, path: '/caixinha-desabafo', label: 'Caixinha de Desabafo', searchDescription: 'Canal anônimo' },
        { icon: MessageCircle, path: '/mensagens-encaminhadas', label: 'Mensagens Encaminhadas', searchDescription: 'Mensagens encaminhadas' },
        { icon: Phone, path: '/whatsapp-avisos', label: 'WhatsApp Avisos', searchDescription: 'Mensagens WhatsApp para clientes' },
      ],
    },
    {
      id: 'administrativo',
      label: 'Administrativo & Config.',
      emoji: '⚙️',
      icon: Settings,
      items: [
        { icon: Shield, path: '/admin', label: 'Admin', searchDescription: 'Configurações do sistema', badgeCount: pendingUsersCount, condition: isAdmin },
        { icon: Phone, path: '/cadastros-uteis', label: 'Cadastros Úteis', searchDescription: 'Telefones e contatos úteis' },
      ],
    },
  ];
}

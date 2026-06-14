import {
  Home,
  Bot,
  SpellCheck,
  FolderOpen,
  Award,
  History,
  UserCircle,
  Shield,
  MessageSquare,
  Scale,
  Clock,
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
  _isSocio: boolean,
  counts: MenuCounts = {}
): MenuGroupDef[] {
  const { pendingUsersCount = 0 } = counts;

  return [
    {
      id: 'principal',
      label: 'Principal',
      emoji: '🏠',
      icon: Home,
      items: [
        { icon: Home,     path: '/dashboard',   label: 'Dashboard',  searchDescription: 'Visão geral do sistema' },
        { icon: History,  path: '/historico',   label: 'Histórico',  searchDescription: 'Histórico de uso e atividades' },
      ],
    },
    {
      id: 'ia',
      label: 'Inteligência Artificial',
      emoji: '🤖',
      icon: Bot,
      items: [
        { icon: MessageSquare, path: '/assistente-ia',      label: 'Assistente de IA',      searchDescription: 'Chat multi-modelo com IA' },
        { icon: Bot,           path: '/agentes-ia',          label: 'Agentes do Tribuna IA', searchDescription: 'Agentes personalizados e GPTs' },
        { icon: Award,         path: '/especialistas',       label: 'Especialistas',          searchDescription: 'Especialistas jurídicos por área' },
        { icon: SpellCheck,    path: '/corretor-portugues',  label: 'Corretor Jurídico',     searchDescription: 'Análise gramatical de documentos' },
      ],
    },
    {
      id: 'juridico',
      label: 'Jurídico',
      emoji: '⚖️',
      icon: Scale,
      items: [
        { icon: FolderOpen, path: '/casos',           label: 'Casos',  searchDescription: 'Gerenciar casos jurídicos' },
        { icon: Clock,      path: '/controle-prazos', label: 'Prazos', searchDescription: 'Controle de prazos processuais' },
      ],
    },
    {
      id: 'config',
      label: 'Configurações',
      emoji: '⚙️',
      icon: UserCircle,
      items: [
        { icon: UserCircle, path: '/profile', label: 'Meu Perfil',    searchDescription: 'Editar perfil e preferências' },
        { icon: Shield,     path: '/admin',   label: 'Administração', searchDescription: 'Painel de administração', badgeCount: pendingUsersCount, condition: isAdmin },
      ],
    },
  ];
}

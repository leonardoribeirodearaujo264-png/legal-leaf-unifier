import { ReactNode, useEffect, useState, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LogOut, Search as SearchIcon, ArrowLeft, Menu, MessageCircle, Bell, BellOff, BellRing, PanelLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UpdatesNotification } from '@/components/UpdatesNotification';
import { SystemUpdatesNotification } from '@/components/SystemUpdatesNotification';
import { NotificationToast } from '@/components/NotificationToast';
import { MessagePopupDialog } from '@/components/MessagePopupDialog';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAccessTracking } from '@/hooks/useAccessTracking';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import { getMenuGroups } from '@/lib/menuData';

import logoEggNunes from '@/assets/logo-eggnunes.png';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { signOut, user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const showBackButton = location.pathname !== '/dashboard' && location.pathname !== '/';
  
  // Hook for real-time message notifications
  const { unreadCount: unreadMessagesCount, popupEnabled, lastReceivedMessage, dismissPopup } = useMessageNotifications();
  
  // Rastrear acessos às páginas
  useAccessTracking();
  
  // Fix mobile scroll on route change
  useLayoutEffect(() => {
    const enableScroll = () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.body.style.overflowY = 'scroll';
    };
    
    enableScroll();
    const timeout = setTimeout(enableScroll, 100);
    
    return () => clearTimeout(timeout);
  }, [location.pathname]);
  
  const handleBack = () => {
    navigate(-1);
  };

  // Keyboard shortcut for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnreadAnnouncementsCount();

      // Escutar mudanças em tempo real nos avisos
      const announcementsChannel = supabase
        .channel('announcements-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcements',
          },
          () => {
            fetchUnreadAnnouncementsCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcement_reads',
          },
          () => {
            fetchUnreadAnnouncementsCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(announcementsChannel);
      };
    }
  }, [user]);

  const fetchUnreadAnnouncementsCount = async () => {
    if (!user) return;

    const { data: announcements } = await supabase
      .from('announcements')
      .select('id');

    if (!announcements) return;

    const { data: readAnnouncements } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);

    const readIds = new Set(readAnnouncements?.map(r => r.announcement_id) || []);
    const unreadCount = announcements.filter(a => !readIds.has(a.id)).length;

    setUnreadAnnouncementsCount(unreadCount);
  };

  // All searchable items generated dynamically from shared menu data
  const allSearchableItems = useMemo(() => {
    const groups = getMenuGroups(isAdmin, profile?.position === 'socio', {});
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(i => i.condition === undefined || i.condition),
      }))
      .filter(g => g.items.length > 0)
      .flatMap(g =>
        g.items.map(i => ({
          path: i.path,
          label: i.label,
          description: i.searchDescription || '',
          category: g.label,
        }))
      );
  }, [isAdmin, profile?.position]);

  const searchCategories = [...new Set(allSearchableItems.map(item => item.category))];

  const handleSearchSelect = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-[100dvh] flex w-full">
        <AppSidebar unreadMessagesCount={unreadMessagesCount} />
        
        <SidebarInset className="flex-1 flex flex-col">
          {/* Global Search Dialog */}
          <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
            <CommandInput placeholder="Buscar na intranet... (Ctrl+K)" />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              {searchCategories.map((category) => {
                const items = allSearchableItems.filter(item => item.category === category);
                if (items.length === 0) return null;
                return (
                  <CommandGroup key={category} heading={category}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.path}
                        onSelect={() => handleSearchSelect(item.path)}
                        className="gap-2 cursor-pointer"
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{item.description}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </CommandDialog>

          {/* Top Bar */}
          <header className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur-sm bg-card/95">
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="-ml-1" />
                
                {/* Logo with Intranet text - always visible */}
                <div 
                  className="flex items-center gap-2 cursor-pointer" 
                  onClick={() => navigate('/dashboard')}
                >
                  <img 
                    src={logoEggNunes} 
                    alt="Egg Nunes" 
                    className="h-8 object-contain"
                  />
                  <span className="font-semibold text-sm text-foreground hidden sm:inline">Intranet</span>
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                {/* Global Search Button */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSearchOpen(true)}
                  className="hidden md:flex gap-2 text-muted-foreground"
                >
                  <SearchIcon className="w-4 h-4" />
                  <span className="text-sm">Buscar...</span>
                  <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="md:hidden"
                  title="Buscar"
                >
                  <SearchIcon className="w-4 h-4" />
                </Button>

                {/* Messages shortcut */}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/mensagens')}
                  title="Mensagens"
                  className="relative"
                >
                  <MessageCircle className="w-4 h-4" />
                  {unreadMessagesCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 flex items-center justify-center text-[10px] animate-pulse">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </Badge>
                  )}
                </Button>

                <NotificationsPanel />
                <UpdatesNotification />
                <SystemUpdatesNotification />
                <ThemeToggle />
                
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {profile?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{profile?.full_name}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                      Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/historico')} className="cursor-pointer">
                      Histórico
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Notification Permission Banner */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
            <div className="bg-accent/50 border-b border-accent px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">
                  Ative as notificações para receber alertas de novas mensagens mesmo com a aba minimizada
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  Notification.requestPermission().then(() => {
                    // Force re-render by toggling a dummy state
                    window.dispatchEvent(new Event('notification-permission-changed'));
                  });
                }}
              >
                Ativar
              </Button>
            </div>
          )}

          {/* Notification Denied Warning */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' && (
            <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center gap-2">
              <BellOff className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">
                Notificações bloqueadas. Para reativar, clique no ícone de cadeado na barra de endereço do navegador e permita notificações.
              </span>
            </div>
          )}

          {/* Unread Messages Banner */}
          {unreadMessagesCount > 0 && location.pathname !== '/mensagens' && (
            <div 
              className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-colors"
              onClick={() => navigate('/mensagens')}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary animate-bounce" />
                <span className="text-sm font-medium text-primary">
                  Você tem {unreadMessagesCount} mensagem{unreadMessagesCount !== 1 ? 'ns' : ''} não lida{unreadMessagesCount !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-xs text-primary/70 hidden sm:inline">Clique para ver →</span>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-x-hidden overflow-y-auto min-w-0">
              {showBackButton && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-2 mb-4 hover:bg-primary/10 self-start flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              )}
              {children}
              <NotificationToast />
              <MessagePopupDialog 
                message={lastReceivedMessage} 
                onDismiss={dismissPopup} 
                enabled={popupEnabled} 
              />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

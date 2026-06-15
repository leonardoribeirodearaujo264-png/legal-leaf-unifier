import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  UserCircle,
  Settings,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getMenuGroups } from '@/lib/menuData';
import { Logo } from '@/components/brand/Logo';

const STORAGE_KEY = 'sidebar-open-groups';
const sidebarScrollPositions = new Map<string, number>();

function loadOpenGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set<string>();
}

function saveOpenGroups(groups: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
  } catch { /* ignore */ }
}

type AppSidebarProps = Record<string, never>;

export function AppSidebar(_: AppSidebarProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, profile } = useUserRole();
  const { user, signOut } = useAuth();
  const { state } = useSidebar();
  const { theme, setTheme } = useTheme();
  const collapsed = state === 'collapsed';
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const isRestoringScroll = useRef(false);

  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      setPendingUsersCount(count || 0);
    };
    fetchPendingCount();
  }, [isAdmin]);

  const isSocio = profile?.position === 'socio';

  const menuGroups = useMemo(
    () => getMenuGroups(isAdmin, isSocio, { pendingUsersCount }),
    [isAdmin, isSocio, pendingUsersCount]
  );

  const filteredGroups = useMemo(
    () =>
      menuGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.condition === undefined || item.condition),
        }))
        .filter((group) => group.items.length > 0),
    [menuGroups]
  );

  const activeGroupId = useMemo(() => {
    for (const group of filteredGroups) {
      if (group.items.some((item) => location.pathname === item.path)) return group.id;
    }
    return null;
  }, [location.pathname, filteredGroups]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => loadOpenGroups());

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpenGroups(next);
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (path: string) => {
      if (sidebarContentRef.current) {
        const pos = sidebarContentRef.current.scrollTop;
        scrollPositionRef.current = pos;
        sidebarScrollPositions.set('sidebar', pos);
      }
      navigate(path);
    },
    [navigate]
  );

  useLayoutEffect(() => {
    const savedPos = scrollPositionRef.current || sidebarScrollPositions.get('sidebar') || 0;
    if (savedPos <= 0) return;

    isRestoringScroll.current = true;
    const restoreScroll = () => {
      if (sidebarContentRef.current) sidebarContentRef.current.scrollTop = savedPos;
    };

    restoreScroll();
    requestAnimationFrame(restoreScroll);
    const t1 = setTimeout(restoreScroll, 100);
    const t2 = setTimeout(restoreScroll, 250);
    const t3 = setTimeout(() => {
      restoreScroll();
      isRestoringScroll.current = false;
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname]);

  const handleSidebarScroll = useCallback(() => {
    if (!isRestoringScroll.current && sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      sidebarScrollPositions.set('sidebar', pos);
    }
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const initials = (profile?.full_name || user?.email || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const isDark = theme === 'dark';

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar shadow-2xl">
      {/* ── Header ─────────────────────────────────────── */}
      <SidebarHeader className="border-b border-sidebar-border/60 px-3.5 py-3.5">
        {collapsed ? (
          <Logo variant="icon" size="sm" />
        ) : (
          <Logo variant="full" size="sm" />
        )}
      </SidebarHeader>

      {/* ── Menu ───────────────────────────────────────── */}
      <SidebarContent
        ref={sidebarContentRef}
        onScroll={handleSidebarScroll}
        className="overflow-y-auto px-2.5 py-3"
      >
        {filteredGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups.has(group.id) || activeGroupId === group.id}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <SidebarGroup className="mb-1.5 py-0">
              {/* Section label */}
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="group/label mb-1 flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/35 transition-colors hover:text-sidebar-foreground/65">
                  {collapsed ? (
                    <group.icon className="h-4 w-4 text-sidebar-foreground/40" />
                  ) : (
                    <>
                      <span>{group.label}</span>
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          openGroups.has(group.id) || activeGroupId === group.id ? 'rotate-90' : ''
                        }`}
                      />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            onClick={() => handleNavigate(item.path)}
                            isActive={active}
                            tooltip={collapsed ? item.label : undefined}
                            className={[
                              'relative h-11 gap-3 rounded-xl px-3 text-[15px] font-medium transition-all duration-150',
                              active
                                ? 'bg-gradient-to-r from-primary to-blue-500 text-white shadow-md shadow-primary/30 hover:from-primary/90 hover:to-blue-500/90'
                                : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                            ].join(' ')}
                          >
                            {active && !collapsed && (
                              <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-white/80" />
                            )}
                            <item.icon
                              className={`h-5 w-5 flex-shrink-0 transition-colors ${
                                active ? 'text-white' : 'text-sidebar-foreground/55'
                              }`}
                            />
                            {!collapsed && (
                              <span className="truncate">{item.label}</span>
                            )}
                            {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                              <Badge
                                variant="destructive"
                                className="ml-auto h-5 min-w-5 px-1.5 text-[10px]"
                              >
                                {item.badgeCount}
                              </Badge>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      {/* ── Footer ─────────────────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2.5">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title={isDark ? 'Tema claro' : 'Tema escuro'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-sidebar-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="font-semibold text-sm">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" /> Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Sair do Sistema
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sair do sistema?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sua sessão será encerrada. Você precisará fazer login novamente para acessar o Tribuna IA.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={signOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Sair
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* User card */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sidebar-accent">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                      {initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[14px] font-semibold text-sidebar-foreground leading-tight">
                      {profile?.full_name || 'Usuário'}
                    </p>
                    <p className="truncate text-[12px] text-sidebar-foreground/45 mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-sidebar-foreground/35" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" /> Meu Perfil
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Settings className="mr-2 h-4 w-4" /> Administração
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <SidebarSeparator className="bg-sidebar-border/40" />

            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              {isDark ? (
                <><Sun className="h-5 w-5" /><span>Tema Claro</span></>
              ) : (
                <><Moon className="h-5 w-5" /><span>Tema Escuro</span></>
              )}
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-red-400/80 transition-all hover:bg-red-500/10 hover:text-red-400">
                  <LogOut className="h-5 w-5" />
                  <span>Sair do Sistema</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sair do sistema?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sua sessão será encerrada. Você precisará fazer login novamente para acessar o Tribuna IA.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={signOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

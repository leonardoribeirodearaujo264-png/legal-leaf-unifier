import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getMenuGroups } from '@/lib/menuData';


// localStorage key
const STORAGE_KEY = 'sidebar-open-groups';

// Module-level persistent scroll storage
const sidebarScrollPositions = new Map<string, number>();

function loadOpenGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set<string>();
}

function saveOpenGroups(groups: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
  } catch {}
}

interface AppSidebarProps {
  unreadMessagesCount?: number;
}

export function AppSidebar({ unreadMessagesCount: externalUnreadCount }: AppSidebarProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, profile } = useUserRole();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const isRestoringScroll = useRef(false);

  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [criticalTasksCount, setCriticalTasksCount] = useState(0);
  const unreadMessagesCount = externalUnreadCount ?? 0;

  useEffect(() => {
    if (isAdmin) fetchPendingCount();
    fetchCriticalTasksCount();
  }, [isAdmin, profile?.full_name]);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');
    setPendingUsersCount(count || 0);
  };

  const fetchCriticalTasksCount = async () => {
    if (!profile?.full_name) return;
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks', {
        body: { force_refresh: false },
      });
      if (error) return;
      let tasksData: any[] = [];
      if (data?.data && Array.isArray(data.data)) tasksData = data.data;
      else if (Array.isArray(data)) tasksData = data;
      else if (data && typeof data === 'object') tasksData = data.tasks || data.items || [];

      const currentName = profile.full_name.toLowerCase();
      const userTasks = tasksData.filter((task: any) => {
        const isPending = task.status?.toLowerCase() === 'pending' || task.status?.toLowerCase() === 'pendente';
        const isInProgress = task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'em andamento';
        const isUserTask = task.assigned_to?.toLowerCase().includes(currentName);
        return (isPending || isInProgress) && isUserTask && task.due_date;
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = userTasks.filter((task: any) => {
        try {
          const d = new Date(task.due_date);
          d.setHours(0, 0, 0, 0);
          return d <= today;
        } catch { return false; }
      }).length;
      setCriticalTasksCount(count);
    } catch {}
  };

  const isSocio = profile?.position === 'socio';

  // ─── Menu Groups from shared source ───────────────────────
  const menuGroups = useMemo(
    () => getMenuGroups(isAdmin, isSocio, { criticalTasksCount, pendingUsersCount, unreadMessagesCount }),
    [isAdmin, isSocio, criticalTasksCount, pendingUsersCount, unreadMessagesCount]
  );

  // Filter out items whose condition is false
  const filteredGroups = useMemo(() =>
    menuGroups.map(g => ({
      ...g,
      items: g.items.filter(i => i.condition === undefined || i.condition),
    })).filter(g => g.items.length > 0),
    [menuGroups]
  );

  // ─── Determine which group contains the active route ──────
  const activeGroupId = useMemo(() => {
    for (const g of filteredGroups) {
      if (g.items.some(i => location.pathname === i.path)) return g.id;
    }
    return null;
  }, [location.pathname, filteredGroups]);

  // ─── Open groups state with localStorage persistence ──────
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    return loadOpenGroups();
  });

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpenGroups(next);
      return next;
    });
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // ─── Scroll preservation ──────────────────────────────────
  const handleSidebarScroll = useCallback(() => {
    if (!isRestoringScroll.current && sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      sidebarScrollPositions.set('sidebar', pos);
    }
  }, []);

  const handleNavigate = useCallback((path: string) => {
    if (sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      sidebarScrollPositions.set('sidebar', pos);
    }
    navigate(path);
  }, [navigate]);

  useLayoutEffect(() => {
    const savedPos = scrollPositionRef.current || sidebarScrollPositions.get('sidebar') || 0;
    if (savedPos > 0) {
      isRestoringScroll.current = true;
      const restoreScroll = () => {
        if (sidebarContentRef.current) sidebarContentRef.current.scrollTop = savedPos;
      };
      restoreScroll();
      requestAnimationFrame(restoreScroll);
      const t1 = setTimeout(restoreScroll, 100);
      const t2 = setTimeout(restoreScroll, 250);
      const t3 = setTimeout(() => { restoreScroll(); isRestoringScroll.current = false; }, 500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [location.pathname]);

  // ─── Render ───────────────────────────────────────────────
  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed && <span className="font-semibold text-sm text-muted-foreground">Menu</span>}
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} onScroll={handleSidebarScroll} className="overflow-y-auto">
        {filteredGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups.has(group.id)}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {collapsed ? (
                      <group.icon className="h-4 w-4" />
                    ) : (
                      <>
                        <span>{group.emoji}</span>
                        <span>{group.label}</span>
                      </>
                    )}
                  </span>
                  {!collapsed && (
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${openGroups.has(group.id) ? 'rotate-180' : ''}`} />
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          onClick={() => handleNavigate(item.path)}
                          isActive={isActive(item.path)}
                          tooltip={collapsed ? item.label : undefined}
                          className="gap-2"
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                              {item.badgeCount}
                            </Badge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

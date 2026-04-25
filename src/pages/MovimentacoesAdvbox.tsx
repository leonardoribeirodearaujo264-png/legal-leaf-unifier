import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { TaskCreationDialog } from '@/components/TaskCreationDialog';
import { TaskSuggestionsPanel } from '@/components/TaskSuggestionsPanel';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, Search, Filter, Calendar, ListTodo, RefreshCw, BarChart } from 'lucide-react';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { tutorialsByPage } from '@/components/tutorialData';

interface Lawsuit {
  id: number;
  process_number: string;
  protocol_number: string | null;
  folder: string | null;
  process_date: string | null;
  fees_expec: number | null;
  fees_money: number | null;
  contingency: number | null;
  type_lawsuit_id: number;
  type: string;
  group_id: number;
  group: string;
  created_at: string;
  status_closure: string | null;
  exit_production: string | null;
  exit_execution: string | null;
  responsible_id: number;
  responsible: string;
  customers?: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

interface Movement {
  lawsuit_id: number;
  // `date` é a data REAL do andamento; pode ser null em alguns retornos do ADVBox.
  // Por isso usamos os campos abaixo como fallback (nesta ordem) ao calcular a data efetiva.
  date: string | null;
  date_deadline?: string | null;
  created_at?: string | null;
  title: string;
  header: string;
  process_number: string;
  protocol_number: string | null;
  customers: string | { name: string; customer_id?: number } | { name: string; customer_id?: number }[];
}

// Retorna a data efetiva da movimentação seguindo a ordem: date → date_deadline → created_at.
// Movimentações sem nenhuma data válida ou com data no futuro (> hoje) retornam null e são descartadas.
const getEffectiveDate = (m: Movement): Date | null => {
  const candidates = [m.date, m.date_deadline, m.created_at];
  for (const raw of candidates) {
    if (!raw) continue;
    // Normaliza "YYYY-MM-DD HH:mm:ss" → ISO; aceita também ISO direto.
    const iso = String(raw).replace(' ', 'T');
    const parsed = new Date(iso);
    if (isNaN(parsed.getTime())) continue;
    // Descarta datas no futuro (bug ADVBox: alguns andamentos vêm com date_deadline futuro).
    if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) continue;
    return parsed;
  }
  return null;
};

const MOVEMENTS_CACHE_KEY = 'advbox-movements-full-cache';
const MOVEMENTS_CACHE_TIMESTAMP_KEY = 'advbox-movements-full-cache-timestamp';
const LAWSUITS_CACHE_KEY = 'advbox-processos-cache';

export default function MovimentacoesAdvbox() {
  // Load from cache immediately
  const loadMovementsFromCache = (): Movement[] | null => {
    try {
      const cached = localStorage.getItem(MOVEMENTS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (e) { console.error('Cache error:', e); }
    return null;
  };

  const loadLawsuitsFromCache = (): Lawsuit[] => {
    try {
      const cached = localStorage.getItem(LAWSUITS_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        return data.lawsuits || [];
      }
    } catch (e) { console.error('Cache error:', e); }
    return [];
  };

  const cachedMovements = loadMovementsFromCache();
  const cachedLawsuits = loadLawsuitsFromCache();

  const [movements, setMovements] = useState<Movement[]>(cachedMovements || []);
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>(cachedLawsuits);
  const [loading, setLoading] = useState(!cachedMovements);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>();
  const [metadata, setMetadata] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showAllStatuses, setShowAllStatuses] = useState(true);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [showAllResponsibles, setShowAllResponsibles] = useState(true);
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [showAllActionTypes, setShowAllActionTypes] = useState(true);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [showAllAreas, setShowAllAreas] = useState(true);

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  const { toast } = useToast();

  // Build maps from lawsuits
  const lawsuitMap = new Map<number, Lawsuit>();
  lawsuits.forEach(l => lawsuitMap.set(l.id, l));

  const responsibles = Array.from(new Set(lawsuits.map(l => l.responsible).filter(Boolean)));
  const actionTypes = Array.from(new Set(lawsuits.map(l => l.type).filter(Boolean)));
  const areas = Array.from(new Set(lawsuits.map(l => l.group).filter(Boolean)));
  const statuses = ['Ativo', 'Inativo'];

  const getCustomerName = (customers: Movement['customers']): string => {
    if (!customers) return '';
    if (typeof customers === 'string') return customers;
    if (Array.isArray(customers)) return customers.map(c => c.name).join(', ');
    return customers.name ?? '';
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'week': return startOfDay(subDays(now, 7));
      case 'month': return startOfDay(subMonths(now, 1));
      case 'quarter': return startOfDay(subMonths(now, 3));
      case '6months': return startOfDay(subMonths(now, 6));
      case 'year': return startOfDay(subMonths(now, 12));
      default: return null;
    }
  };

  // Filter movements
  const filteredMovements = movements.filter(movement => {
    const customerName = getCustomerName(movement.customers);
    const associatedLawsuit = lawsuitMap.get(movement.lawsuit_id);
    const movementResponsible = associatedLawsuit?.responsible;
    const movementType = associatedLawsuit?.type;
    const movementArea = associatedLawsuit?.group;
    const dateFilter = getDateFilter();

    const matchesSearch = !searchTerm ||
      movement.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.header?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesResponsible = showAllResponsibles ||
      (movementResponsible && selectedResponsibles.includes(movementResponsible));

    const matchesPeriod = !dateFilter || !isBefore(new Date(movement.date), dateFilter);

    const isActive = associatedLawsuit ? !associatedLawsuit.status_closure : true;
    const lawsuitStatus = isActive ? 'Ativo' : 'Inativo';
    const matchesStatus = showAllStatuses ||
      selectedStatuses.includes(lawsuitStatus);

    const matchesActionType = showAllActionTypes ||
      (movementType && selectedActionTypes.includes(movementType));

    const matchesArea = showAllAreas ||
      (movementArea && selectedAreas.includes(movementArea));

    return matchesSearch && matchesResponsible && matchesPeriod && matchesStatus && matchesActionType && matchesArea;
  });

  // Timeline chart data - always uses ALL movements (not filtered by period)
  const getTimelineData = () => {
    const dateCounts: Record<string, { date: Date; count: number }> = {};
    // Use all movements for the chart, only apply non-period filters
    const chartMovements = movements.filter(movement => {
      const customerName = getCustomerName(movement.customers);
      const associatedLawsuit = lawsuitMap.get(movement.lawsuit_id);
      const movementResponsible = associatedLawsuit?.responsible;
      const movementType = associatedLawsuit?.type;
      const movementArea = associatedLawsuit?.group;
      const isActive = associatedLawsuit ? !associatedLawsuit.status_closure : true;
      const lawsuitStatus = isActive ? 'Ativo' : 'Inativo';

      const matchesSearch = !searchTerm ||
        movement.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.header?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesResponsible = showAllResponsibles || (movementResponsible && selectedResponsibles.includes(movementResponsible));
      const matchesStatus = showAllStatuses || selectedStatuses.includes(lawsuitStatus);
      const matchesActionType = showAllActionTypes || (movementType && selectedActionTypes.includes(movementType));
      const matchesArea = showAllAreas || (movementArea && selectedAreas.includes(movementArea));

      return matchesSearch && matchesResponsible && matchesStatus && matchesActionType && matchesArea;
    });
    chartMovements.forEach(m => {
      try {
        const dateStr = m.date?.replace(' ', 'T');
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return;
        const dateKey = format(parsed, 'yyyy-MM-dd');
        if (!dateCounts[dateKey]) {
          dateCounts[dateKey] = { date: parsed, count: 0 };
        }
        dateCounts[dateKey].count++;
      } catch {
        // Skip invalid dates
      }
    });
    return Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([, { date, count }]) => ({
        date: format(date, 'dd/MM', { locale: ptBR }),
        movimentações: count,
      }));
  };

  const fetchData = async (forceRefresh = false) => {
    try {
      const refreshParam = forceRefresh ? '?force_refresh=true' : '';
      const [movementsRes, lawsuitsRes] = await Promise.all([
        supabase.functions.invoke(`advbox-integration/movements-full${refreshParam}`),
        supabase.functions.invoke(`advbox-integration/lawsuits-full${refreshParam}`),
      ]);

      if (movementsRes.error) throw movementsRes.error;

      const rawMovements = movementsRes.data as any;
      const movementsPayload = Array.isArray(rawMovements) ? { data: rawMovements } : (rawMovements || {});
      const movementsArray: Movement[] = movementsPayload.data || [];

      const rawLawsuits = lawsuitsRes.data as any;
      const lawsuitsPayload = Array.isArray(rawLawsuits) ? { data: rawLawsuits } : (rawLawsuits || {});
      const lawsuitsArray: Lawsuit[] = lawsuitsPayload.data || [];

      if (movementsArray.length > 0 || movements.length === 0) {
        setMovements(movementsArray);
        // Save to cache
        try {
          const minimal = movementsArray.map(m => ({
            lawsuit_id: m.lawsuit_id, date: m.date, title: m.title,
            header: m.header, process_number: m.process_number,
            protocol_number: m.protocol_number, customers: m.customers,
          }));
          localStorage.setItem(MOVEMENTS_CACHE_KEY, JSON.stringify(minimal));
          localStorage.setItem(MOVEMENTS_CACHE_TIMESTAMP_KEY, new Date().toISOString());
        } catch (e) { console.warn('Cache save error:', e); }
      }

      if (lawsuitsArray.length > 0) {
        setLawsuits(lawsuitsArray);
      }

      setMetadata(rawMovements?.metadata || null);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching movements:', error);
      if (!cachedMovements) {
        toast({ title: 'Erro ao carregar movimentações', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cachedMovements) {
      setIsRefreshing(true);
      fetchData().finally(() => setIsRefreshing(false));
    } else {
      fetchData();
    }
  }, []);

  const openTaskDialog = (movement: Movement) => {
    setSelectedMovement(movement);
    setTaskDialogOpen(true);
  };

  const activeFiltersCount = 
    (!showAllResponsibles ? selectedResponsibles.length : 0) +
    (!showAllStatuses ? selectedStatuses.length : 0) +
    (!showAllActionTypes ? selectedActionTypes.length : 0) +
    (!showAllAreas ? selectedAreas.length : 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando movimentações...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-primary" />
              Movimentações
              <TutorialOverlay pageKey="movimentacoes" pageName={tutorialsByPage.movimentacoes.pageName} steps={tutorialsByPage.movimentacoes.steps} />
            </h1>
            <p className="text-muted-foreground mt-2">
              Acompanhe todas as movimentações dos processos
            </p>
            <div className="mt-2 flex items-center gap-3">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
              {isRefreshing && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando dados...
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); fetchData(true).finally(() => setIsRefreshing(false)); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {/* Timeline */}
        {filteredMovements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Timeline de Movimentações
                <span className="text-sm text-muted-foreground ml-2">(Últimos 30 dias)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsBarChart data={getTimelineData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="movimentações" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filters + List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Movimentações
              <span className="text-sm text-muted-foreground ml-2">({filteredMovements.length})</span>
            </CardTitle>
            <CardDescription>Últimas atualizações dos processos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar movimentações..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="quarter">Últimos 3 meses</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Status
                    {!showAllStatuses && selectedStatuses.length > 0 && <Badge variant="secondary" className="ml-1">{selectedStatuses.length}</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Filtrar por Status</h4>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="all-statuses" checked={showAllStatuses} onCheckedChange={(c) => { setShowAllStatuses(!!c); if (c) setSelectedStatuses([]); }} />
                      <label htmlFor="all-statuses" className="text-sm font-medium cursor-pointer">Todos</label>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {statuses.map(s => (
                        <div key={s} className="flex items-center space-x-2">
                          <Checkbox id={`st-${s}`} checked={selectedStatuses.includes(s)}
                            onCheckedChange={(c) => { if (c) { setSelectedStatuses([...selectedStatuses, s]); setShowAllStatuses(false); } else { const next = selectedStatuses.filter(x => x !== s); setSelectedStatuses(next); if (next.length === 0) setShowAllStatuses(true); } }} />
                          <label htmlFor={`st-${s}`} className="text-sm cursor-pointer">{s}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Responsible filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Responsável
                    {!showAllResponsibles && selectedResponsibles.length > 0 && <Badge variant="secondary" className="ml-1">{selectedResponsibles.length}</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Filtrar por Responsável</h4>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="all-resp" checked={showAllResponsibles} onCheckedChange={(c) => { setShowAllResponsibles(!!c); if (c) setSelectedResponsibles([]); }} />
                      <label htmlFor="all-resp" className="text-sm font-medium cursor-pointer">Todos</label>
                    </div>
                    <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
                      {responsibles.map(r => (
                        <div key={r} className="flex items-center space-x-2">
                          <Checkbox id={`resp-${r}`} checked={selectedResponsibles.includes(r)}
                            onCheckedChange={(c) => { if (c) { setSelectedResponsibles([...selectedResponsibles, r]); setShowAllResponsibles(false); } else { const next = selectedResponsibles.filter(x => x !== r); setSelectedResponsibles(next); if (next.length === 0) setShowAllResponsibles(true); } }} />
                          <label htmlFor={`resp-${r}`} className="text-sm cursor-pointer">{r}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Action type filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Tipo de Ação
                    {!showAllActionTypes && selectedActionTypes.length > 0 && <Badge variant="secondary" className="ml-1">{selectedActionTypes.length}</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Filtrar por Tipo de Ação</h4>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="all-types" checked={showAllActionTypes} onCheckedChange={(c) => { setShowAllActionTypes(!!c); if (c) setSelectedActionTypes([]); }} />
                      <label htmlFor="all-types" className="text-sm font-medium cursor-pointer">Todos</label>
                    </div>
                    <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
                      {actionTypes.map(t => (
                        <div key={t} className="flex items-center space-x-2">
                          <Checkbox id={`type-${t}`} checked={selectedActionTypes.includes(t)}
                            onCheckedChange={(c) => { if (c) { setSelectedActionTypes([...selectedActionTypes, t]); setShowAllActionTypes(false); } else { const next = selectedActionTypes.filter(x => x !== t); setSelectedActionTypes(next); if (next.length === 0) setShowAllActionTypes(true); } }} />
                          <label htmlFor={`type-${t}`} className="text-sm cursor-pointer">{t}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Area filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Área
                    {!showAllAreas && selectedAreas.length > 0 && <Badge variant="secondary" className="ml-1">{selectedAreas.length}</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Filtrar por Área</h4>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="all-areas" checked={showAllAreas} onCheckedChange={(c) => { setShowAllAreas(!!c); if (c) setSelectedAreas([]); }} />
                      <label htmlFor="all-areas" className="text-sm font-medium cursor-pointer">Todas</label>
                    </div>
                    <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
                      {areas.map(a => (
                        <div key={a} className="flex items-center space-x-2">
                          <Checkbox id={`area-${a}`} checked={selectedAreas.includes(a)}
                            onCheckedChange={(c) => { if (c) { setSelectedAreas([...selectedAreas, a]); setShowAllAreas(false); } else { const next = selectedAreas.filter(x => x !== a); setSelectedAreas(next); if (next.length === 0) setShowAllAreas(true); } }} />
                          <label htmlFor={`area-${a}`} className="text-sm cursor-pointer">{a}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{activeFiltersCount} filtro(s) ativo(s)</span>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowAllStatuses(true); setSelectedStatuses([]);
                  setShowAllResponsibles(true); setSelectedResponsibles([]);
                  setShowAllActionTypes(true); setSelectedActionTypes([]);
                  setShowAllAreas(true); setSelectedAreas([]);
                  setPeriodFilter('all'); setSearchTerm('');
                }}>Limpar todos</Button>
              </div>
            )}

            {/* Task Suggestions */}
            <TaskSuggestionsPanel
              items={filteredMovements.map(m => ({
                id: `${m.lawsuit_id}-${m.date}`,
                title: m.title,
                type: m.title,
                process_number: m.process_number,
                lawsuit_id: m.lawsuit_id,
              }))}
              lawsuits={lawsuits}
            />

            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma movimentação encontrada
                  </p>
                ) : (
                  filteredMovements.map((movement, index) => {
                    const associatedLawsuit = lawsuitMap.get(movement.lawsuit_id);
                    return (
                      <div key={`${movement.lawsuit_id}-${index}`} className="border-l-2 border-primary/30 pl-3 pb-4 mb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {new Date(movement.date).toLocaleDateString('pt-BR')}
                            </Badge>
                            {associatedLawsuit && (
                              <>
                                <Badge variant="secondary" className="text-xs">{associatedLawsuit.type}</Badge>
                                <Badge variant="outline" className="text-xs">{associatedLawsuit.group}</Badge>
                              </>
                            )}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => openTaskDialog(movement)}>
                            <ListTodo className="h-4 w-4 mr-1" />
                            Criar Tarefa
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-primary mb-1">{movement.process_number}</p>
                            {movement.customers && (
                              <p className="text-xs text-muted-foreground">Cliente: {getCustomerName(movement.customers)}</p>
                            )}
                            {associatedLawsuit?.responsible && (
                              <p className="text-xs text-muted-foreground">Responsável: {associatedLawsuit.responsible}</p>
                            )}
                          </div>
                          <div className="bg-muted/30 p-2 rounded">
                            <p className="text-xs font-medium mb-1">{movement.title}</p>
                            {movement.header && <p className="text-xs text-muted-foreground">{movement.header}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <TaskCreationDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        selectedMovement={selectedMovement}
        lawsuits={lawsuits}
        onTaskCreated={() => {
          setSelectedMovement(null);
          toast({ title: 'Tarefa criada', description: 'Tarefa criada com sucesso no Advbox.' });
        }}
      />
    </Layout>
  );
}

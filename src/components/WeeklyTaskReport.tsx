import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CalendarDays, 
  Download, 
  FileSpreadsheet, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Users
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, subWeeks, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
  process_number?: string;
  category?: string;
}

interface WeeklyTaskReportProps {
  tasks: Task[];
}

interface ResponsibleStats {
  name: string;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const WeeklyTaskReport = ({ tasks }: WeeklyTaskReportProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [excludeCollective, setExcludeCollective] = useState(false);
  const [activeNames, setActiveNames] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Carregar colaboradores ativos do banco
  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name')
      .eq('is_active', true)
      .eq('is_suspended', false)
      .eq('approval_status', 'approved')
      .then(({ data }) => {
        setActiveNames(
          new Set((data || []).map((p: any) => (p.full_name || '').toUpperCase().trim()).filter(Boolean))
        );
      });
  }, []);

  const selectedWeek = useMemo(() => {
    const baseDate = subWeeks(new Date(), weekOffset);
    return {
      start: startOfWeek(baseDate, { locale: ptBR }),
      end: endOfWeek(baseDate, { locale: ptBR }),
    };
  }, [weekOffset]);

  // Helper: extrai responsáveis ativos de uma tarefa
  const getActiveResponsibles = (task: Task): string[] => {
    const raw = task.assigned_to || '';
    if (!raw.trim()) return [];
    const all = raw.split(',').map((n) => n.trim()).filter(Boolean);
    if (activeNames.size === 0) return all; // ainda carregando: mostra todos
    return all.filter((name) => activeNames.has(name.toUpperCase()));
  };

  const weeklyTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      // Ignorar tarefas descontinuadas/excluídas
      const status = task.status?.toLowerCase();
      if (status === 'stale' || status === 'deleted') return false;
      try {
        const taskDate = parseISO(task.due_date);
        if (!isWithinInterval(taskDate, { start: selectedWeek.start, end: selectedWeek.end })) {
          return false;
        }
      } catch {
        return false;
      }
      // Descartar tarefa sem nenhum responsável ativo
      const activeResp = getActiveResponsibles(task);
      if (activeResp.length === 0) return false;
      // Excluir compromissos coletivos (>5 responsáveis ativos) se toggle ligado
      if (excludeCollective && activeResp.length > 5) return false;
      return true;
    });
  }, [tasks, selectedWeek, activeNames, excludeCollective]);

  const statsByResponsible = useMemo(() => {
    const stats: Record<string, ResponsibleStats> = {};
    const today = startOfDay(new Date());

    weeklyTasks.forEach((task) => {
      const responsibles = getActiveResponsibles(task);
      if (responsibles.length === 0) return;

      const isCompleted = task.status?.toLowerCase() === 'completed' || task.status?.toLowerCase() === 'concluída';
      const taskDate = task.due_date ? parseISO(task.due_date) : null;
      const isOverdue = taskDate && isBefore(taskDate, today) && !isCompleted;

      responsibles.forEach((responsible) => {
        if (!stats[responsible]) {
          stats[responsible] = {
            name: responsible,
            total: 0,
            completed: 0,
            pending: 0,
            overdue: 0,
            completionRate: 0,
          };
        }

        stats[responsible].total++;

        if (isCompleted) {
          stats[responsible].completed++;
        } else if (isOverdue) {
          stats[responsible].overdue++;
        } else {
          stats[responsible].pending++;
        }
      });
    });

    // Calcular taxa de conclusão
    Object.values(stats).forEach((s) => {
      s.completionRate = s.total > 0 ? (s.completed / s.total) * 100 : 0;
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [weeklyTasks]);

  const overallStats = useMemo(() => {
    const total = weeklyTasks.length;
    const completed = weeklyTasks.filter(
      (t) => t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'concluída'
    ).length;
    const today = startOfDay(new Date());
    const overdue = weeklyTasks.filter((t) => {
      if (!t.due_date) return false;
      const isCompleted = t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'concluída';
      const taskDate = parseISO(t.due_date);
      return isBefore(taskDate, today) && !isCompleted;
    }).length;
    const pending = total - completed - overdue;

    return {
      total,
      completed,
      pending,
      overdue,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [weeklyTasks]);

  const chartData = useMemo(() => {
    return statsByResponsible.map((s) => ({
      name: s.name.split(' ')[0], // Apenas primeiro nome
      Concluídas: s.completed,
      Pendentes: s.pending,
      Atrasadas: s.overdue,
    }));
  }, [statsByResponsible]);

  const pieData = useMemo(() => {
    return [
      { name: 'Concluídas', value: overallStats.completed },
      { name: 'Pendentes', value: overallStats.pending },
      { name: 'Atrasadas', value: overallStats.overdue },
    ].filter((d) => d.value > 0);
  }, [overallStats]);

  const exportToExcel = () => {
    // Dados por responsável
    const responsibleData = statsByResponsible.map((s) => ({
      Responsável: s.name,
      'Total de Tarefas': s.total,
      Concluídas: s.completed,
      Pendentes: s.pending,
      Atrasadas: s.overdue,
      'Taxa de Conclusão (%)': s.completionRate.toFixed(1),
    }));

    // Detalhes das tarefas
    const taskDetails = weeklyTasks.map((t) => ({
      Título: t.title,
      Descrição: t.description,
      Responsável: t.assigned_to || 'Não atribuído',
      'Data de Vencimento': t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-',
      Status: t.status,
      Prioridade: t.priority || '-',
      Processo: t.process_number || '-',
    }));

    const wb = XLSX.utils.book_new();
    
    // Planilha de resumo por responsável
    const wsResponsible = XLSX.utils.json_to_sheet(responsibleData);
    XLSX.utils.book_append_sheet(wb, wsResponsible, 'Por Responsável');
    
    // Planilha de tarefas detalhadas
    const wsTasks = XLSX.utils.json_to_sheet(taskDetails);
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Tarefas Detalhadas');

    const weekLabel = format(selectedWeek.start, 'dd-MM', { locale: ptBR }) + '_a_' + 
                      format(selectedWeek.end, 'dd-MM-yyyy', { locale: ptBR });
    XLSX.writeFile(wb, `Relatorio_Tarefas_Semanal_${weekLabel}.xlsx`);

    toast({
      title: 'Exportado com sucesso',
      description: 'Relatório semanal exportado para Excel.',
    });
  };

  const chartConfig = {
    Concluídas: { label: 'Concluídas', color: '#10b981' },
    Pendentes: { label: 'Pendentes', color: '#f59e0b' },
    Atrasadas: { label: 'Atrasadas', color: '#ef4444' },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Relatório Semanal de Tarefas
            </CardTitle>
            <CardDescription>
              Acompanhe o desempenho da equipe por semana
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select 
              value={String(weekOffset)} 
              onValueChange={(v) => setWeekOffset(parseInt(v))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Esta semana</SelectItem>
                <SelectItem value="1">Semana passada</SelectItem>
                <SelectItem value="2">2 semanas atrás</SelectItem>
                <SelectItem value="3">3 semanas atrás</SelectItem>
                <SelectItem value="4">4 semanas atrás</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Período: {format(selectedWeek.start, "d 'de' MMMM", { locale: ptBR })} a{' '}
            {format(selectedWeek.end, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <div className="flex items-center gap-2">
            <Switch
              id="exclude-collective"
              checked={excludeCollective}
              onCheckedChange={setExcludeCollective}
            />
            <Label htmlFor="exclude-collective" className="text-sm cursor-pointer flex items-center gap-1">
              <Users className="h-3 w-3" />
              Excluir compromissos coletivos (&gt;5 responsáveis)
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo Geral */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{overallStats.total}</div>
              <p className="text-xs text-muted-foreground">Total de Tarefas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">{overallStats.completed}</div>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{overallStats.pending}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-red-600">{overallStats.overdue}</div>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {overallStats.completionRate.toFixed(0)}%
              </div>
              <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
            </CardContent>
          </Card>
        </div>

        {weeklyTasks.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma tarefa encontrada para esta semana</p>
          </div>
        ) : (
          <>
            {/* Gráficos */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Gráfico de Barras por Responsável */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Tarefas por Responsável
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="Concluídas" stackId="a" fill="#10b981" />
                        <Bar dataKey="Pendentes" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Atrasadas" stackId="a" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Pizza - Status Geral */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Distribuição de Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.name === 'Concluídas' ? '#10b981' :
                                entry.name === 'Pendentes' ? '#f59e0b' : '#ef4444'
                              } 
                            />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Tabela por Responsável */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Desempenho por Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {statsByResponsible.map((stats) => (
                      <div
                        key={stats.name}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{stats.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {stats.total} tarefa{stats.total !== 1 ? 's' : ''} na semana
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {stats.completed}
                            </Badge>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              <Clock className="h-3 w-3 mr-1" />
                              {stats.pending}
                            </Badge>
                            {stats.overdue > 0 && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {stats.overdue}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right min-w-[60px]">
                            <p className="text-sm font-semibold">
                              {stats.completionRate.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">conclusão</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </CardContent>
    </Card>
  );
};
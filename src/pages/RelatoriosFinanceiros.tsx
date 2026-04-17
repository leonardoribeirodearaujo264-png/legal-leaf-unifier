import { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Shield, Download, FileSpreadsheet, FileText, Percent, Receipt, Activity, ArrowRight, Lock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO, subMonths, subQuarters, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialAlerts } from '@/components/FinancialAlerts';
import { FinancialPredictions } from '@/components/FinancialPredictions';
import { FinancialDistribution } from '@/components/FinancialDistribution';
import { CashFlowProjection } from '@/components/CashFlowProjection';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { FinancialDefaulters } from '@/components/FinancialDefaulters';
import { Link } from 'react-router-dom';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  customer_name?: string;
  due_date?: string;
  status?: 'pending' | 'paid' | 'overdue';
  customer_phone?: string;
  customer_email?: string;
  lawsuit_id?: string;
  lawsuit_number?: string;
  lawsuit_name?: string;
  person_document?: string;
}

const STORAGE_KEY = 'relatorios_financeiros_cache';

// Função para carregar cache - executada antes do componente montar
const loadFromCache = (): { transactions: Transaction[]; timestamp: Date } | null => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const { transactions: cachedTransactions, timestamp } = JSON.parse(cached);
      return { transactions: cachedTransactions, timestamp: new Date(timestamp) };
    }
  } catch (error) {
    console.error('Error loading cached transactions:', error);
  }
  return null;
};

// Carregar cache imediatamente (antes do render)
const initialCache = loadFromCache();

export default function RelatoriosFinanceiros() {
  // TODOS OS HOOKS DEVEM VIR PRIMEIRO - antes de qualquer retorno condicional
  const [transactions, setTransactions] = useState<Transaction[]>(initialCache?.transactions || []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(initialCache?.timestamp);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [isFromCache, setIsFromCache] = useState(!!initialCache);
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canView, loading: permLoading, isSocioOrRafael } = useAdminPermissions();

  const hasFinancialAccess = isSocioOrRafael || canView('financial');

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  const fetchTransactions = useCallback(async (forceRefresh = false, showLoading = false) => {
    // Só mostrar loading se explicitamente solicitado E não tiver dados em cache
    if (showLoading && transactions.length === 0 && !initialCache) {
      setIsRefreshing(true);
    }
    
    try {
      const [transactionsResponse, lawsuitsResponse] = await Promise.all([
        supabase.functions.invoke('advbox-integration/transactions-recent', {
          body: { 
            force_refresh: forceRefresh,
            months: 24
          },
        }),
        supabase.functions.invoke('advbox-integration/lawsuits', {
          body: { force_refresh: false },
        }),
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;

      const apiResponse = transactionsResponse.data?.data || transactionsResponse.data;
      const rawTransactionsData = apiResponse?.data || [];
      
      const lawsuitsData = lawsuitsResponse.data?.data?.data || lawsuitsResponse.data?.data || [];
      const lawsuitMap = new Map<string, { personName: string; personPhone: string; personEmail: string; personDocument: string }>();
      
      if (Array.isArray(lawsuitsData)) {
        lawsuitsData.forEach((lawsuit: any) => {
          const lawsuitId = String(lawsuit.id);
          const personName = lawsuit.person?.name || lawsuit.customer?.name || lawsuit.person_name || lawsuit.customer_name || lawsuit.name_customer || null;
          const personPhone = lawsuit.person?.cellphone || lawsuit.person?.phone || lawsuit.customer?.cellphone || lawsuit.customer?.phone || null;
          const personEmail = lawsuit.person?.email || lawsuit.customer?.email || null;
          const personDocument = lawsuit.person?.document || lawsuit.person?.cpf || lawsuit.person?.cnpj || lawsuit.customer?.document || null;
          
          if (personName) {
            lawsuitMap.set(lawsuitId, { personName, personPhone, personEmail, personDocument });
          }
        });
      }
      
      if (transactionsResponse.data?.metadata?.rateLimited && rawTransactionsData.length === 0) {
        // Dados em cache, não precisa mostrar erro
        setIsFromCache(true);
        return;
      }
      
      const incomeCategories = [
        'RECEITA', 'HONORÁRIO', 'RECEITAS', 'RESULTADO COM APLICAÇÕES',
        'RENDIMENTO', 'REPASSES', 'RECEBIMENTO', 'CRÉDITO', 'A RECEBER',
        'ENTRADA', 'PAGAMENTO CLIENTE', 'FATURAMENTO'
      ];
      
      const mappedTransactions: Transaction[] = rawTransactionsData.map((t: any) => {
        const transactionDate = t.date_payment || t.date_due || null;
        const dueDate = t.date_due || null;
        const apiType = (t.type || t.transaction_type || '').toLowerCase();
        const categoryUpper = (t.category || '').toUpperCase();
        const descriptionUpper = (t.description || '').toUpperCase();
        
        const isIncome = apiType === 'income' || apiType === 'credit' || apiType === 'receita' ||
                        incomeCategories.some(cat => categoryUpper.includes(cat)) ||
                        incomeCategories.some(cat => descriptionUpper.includes(cat)) ||
                        (t.credit_bank && !t.debit_bank) ||
                        descriptionUpper.includes('HONORÁRIO') ||
                        descriptionUpper.includes('RENDIMENTO') ||
                        descriptionUpper.includes('ÊXITO') ||
                        descriptionUpper.includes('SUCUMB');
        
        let status: 'pending' | 'paid' | 'overdue' = 'pending';
        const hasPayment = t.date_payment && t.date_payment.trim() !== '';
        
        if (hasPayment) {
          status = 'paid';
        } else if (dueDate) {
          const dueDateObj = new Date(dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDateObj < today) {
            status = 'overdue';
          }
        }
        
        const lawsuitId = t.lawsuit_id || t.lawsuit?.id || t.lawsuits_id || null;
        const lawsuitData = lawsuitId ? lawsuitMap.get(String(lawsuitId)) : null;
        
        let customerName = t.name || t.customer_name || t.person?.name || t.customer?.name || t.person_name || null;
        let customerPhone = t.person?.cellphone || t.person?.phone || t.customer?.cellphone || t.customer?.phone || null;
        let customerEmail = t.person?.email || t.customer?.email || null;
        let personDocument = t.identification || t.customer_identification || t.person?.document || t.person?.cpf || t.person?.cnpj || t.customer?.document || null;
        
        if (!customerName && lawsuitData) customerName = lawsuitData.personName;
        if (!customerPhone && lawsuitData) customerPhone = lawsuitData.personPhone;
        if (!customerEmail && lawsuitData) customerEmail = lawsuitData.personEmail;
        if (!personDocument && lawsuitData) personDocument = lawsuitData.personDocument;
        
        const lawsuitNumber = t.lawsuit_number || t.lawsuit?.number || t.lawsuit?.process_number || t.process_number || null;
        const lawsuitName = t.lawsuit_name || t.lawsuit?.name || t.lawsuit?.title || null;
        
        return {
          id: String(t.id || Math.random()),
          date: transactionDate,
          description: t.description || 'Sem descrição',
          amount: Math.abs(t.amount || 0),
          type: isIncome ? 'income' : 'expense',
          category: t.category || 'Outros',
          customer_name: customerName,
          due_date: dueDate,
          status: status,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          lawsuit_id: lawsuitId,
          lawsuit_number: lawsuitNumber,
          lawsuit_name: lawsuitName,
          person_document: personDocument,
        };
      });
      
      if (mappedTransactions.length > 0) {
        setTransactions(mappedTransactions);
        setIsFromCache(false);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          transactions: mappedTransactions,
          timestamp: new Date().toISOString()
        }));
      }
      
      setMetadata(transactionsResponse.data?.metadata);
      setLastUpdate(new Date());
      
      if (transactionsResponse.data?.metadata?.rateLimited) {
        setIsFromCache(true);
      }

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'Os relatórios foram recarregados.',
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      // Silenciosamente usar cache em caso de erro
      if (transactions.length > 0) {
        setIsFromCache(true);
      } else {
        toast({
          title: 'Erro ao carregar transações',
          description: 'Não foi possível carregar as transações financeiras.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [toast, transactions.length]);

  // Buscar dados em background quando componente monta (100% silencioso)
  useEffect(() => {
    if (hasFinancialAccess && isAdmin && !roleLoading && !permLoading) {
      // Atualização silenciosa em background - nunca mostra loading
      fetchTransactions(false, false);
    }
  }, [hasFinancialAccess, isAdmin, roleLoading, permLoading]);

  // Atualização automática silenciosa a cada 6 horas — só com aba visível
  useEffect(() => {
    if (!hasFinancialAccess || !isAdmin || roleLoading || permLoading) return;
    
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchTransactions(false);
    }, 6 * 60 * 60 * 1000); // 6 horas
    
    return () => clearInterval(intervalId);
  }, [hasFinancialAccess, isAdmin, roleLoading, permLoading, fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    if (periodFilter === 'all') return transactions;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodFilter) {
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        return transactions;
    }

    return transactions.filter((t) => {
      if (!t.date) return false;
      try {
        const transactionDate = parseISO(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      } catch {
        return false;
      }
    });
  }, [transactions, periodFilter]);

  const previousPeriodTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || periodFilter === 'all') return [];

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodFilter) {
      case 'month':
        const prevMonth = subMonths(now, 1);
        startDate = startOfMonth(prevMonth);
        endDate = endOfMonth(prevMonth);
        break;
      case 'quarter':
        const prevQuarter = subQuarters(now, 1);
        startDate = startOfQuarter(prevQuarter);
        endDate = endOfQuarter(prevQuarter);
        break;
      case 'year':
        const prevYear = subYears(now, 1);
        startDate = startOfYear(prevYear);
        endDate = endOfYear(prevYear);
        break;
      default:
        return [];
    }

    return transactions.filter((t) => {
      if (!t.date) return false;
      try {
        const transactionDate = parseISO(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      } catch {
        return false;
      }
    });
  }, [transactions, periodFilter]);

  const validFilteredTransactions = useMemo(() => {
    return filteredTransactions.filter(t => {
      if (!t.date) return false;
      try {
        const date = new Date(t.date);
        return !isNaN(date.getTime());
      } catch {
        return false;
      }
    });
  }, [filteredTransactions]);

  const { totalIncome, totalExpense, balance, profitMargin, averageTicket, growthRate } = useMemo(() => {
    const income = filteredTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const incomeCount = filteredTransactions.filter((t) => t.type === 'income').length;
    const prevIncome = previousPeriodTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
      profitMargin: income > 0 ? ((income - expense) / income) * 100 : 0,
      averageTicket: incomeCount > 0 ? income / incomeCount : 0,
      growthRate: prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0,
    };
  }, [filteredTransactions, previousPeriodTransactions]);

  const chartData = useMemo(() => {
    if (!Array.isArray(validFilteredTransactions) || validFilteredTransactions.length === 0) return [];

    const monthlyData: Record<string, { month: string; receitas: number; despesas: number }> = {};

    validFilteredTransactions.forEach((transaction) => {
      try {
        const date = new Date(transaction.date);
        const monthKey = format(date, 'MM/yyyy', { locale: ptBR });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey, receitas: 0, despesas: 0 };
        }

        if (transaction.type === 'income') {
          monthlyData[monthKey].receitas += transaction.amount;
        } else {
          monthlyData[monthKey].despesas += transaction.amount;
        }
      } catch (error) {
        console.error('Erro ao processar transação:', transaction, error);
      }
    });

    return Object.values(monthlyData).sort((a, b) => {
      const [monthA, yearA] = a.month.split('/');
      const [monthB, yearB] = b.month.split('/');
      return new Date(parseInt(yearA), parseInt(monthA) - 1).getTime() - 
             new Date(parseInt(yearB), parseInt(monthB) - 1).getTime();
    });
  }, [validFilteredTransactions]);

  const exportToExcel = useCallback(() => {
    const worksheetData = validFilteredTransactions.map((t) => ({
      Data: format(new Date(t.date), 'dd/MM/yyyy', { locale: ptBR }),
      Descrição: t.description,
      Categoria: t.category,
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Valor: t.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transações');

    const summaryData = [
      { Métrica: 'Total de Receitas', Valor: totalIncome },
      { Métrica: 'Total de Despesas', Valor: totalExpense },
      { Métrica: 'Saldo', Valor: balance },
      { Métrica: 'Margem de Lucro (%)', Valor: profitMargin.toFixed(2) },
      { Métrica: 'Ticket Médio', Valor: averageTicket },
      { Métrica: 'Taxa de Crescimento (%)', Valor: growthRate.toFixed(2) },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    const periodLabel = periodFilter === 'all' ? 'Completo' : 
                       periodFilter === 'month' ? 'Mensal' :
                       periodFilter === 'quarter' ? 'Trimestral' : 'Anual';
    XLSX.writeFile(workbook, `Relatorio_Financeiro_${periodLabel}_${format(new Date(), 'ddMMyyyy')}.xlsx`);

    toast({
      title: 'Exportado com sucesso',
      description: 'Relatório exportado para Excel.',
    });
  }, [validFilteredTransactions, totalIncome, totalExpense, balance, profitMargin, averageTicket, growthRate, periodFilter, toast]);

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório Financeiro', 14, 20);
    
    const periodLabel = periodFilter === 'all' ? 'Completo' : 
                       periodFilter === 'month' ? 'Mês Atual' :
                       periodFilter === 'quarter' ? 'Trimestre Atual' : 'Ano Atual';
    doc.setFontSize(12);
    doc.text(`Período: ${periodLabel}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 37);

    doc.setFontSize(14);
    doc.text('Resumo Executivo', 14, 50);
    
    const metricsData = [
      ['Métrica', 'Valor'],
      ['Total de Receitas', formatCurrency(totalIncome)],
      ['Total de Despesas', formatCurrency(totalExpense)],
      ['Saldo', formatCurrency(balance)],
      ['Margem de Lucro', `${profitMargin.toFixed(2)}%`],
      ['Ticket Médio', formatCurrency(averageTicket)],
      ['Taxa de Crescimento', `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(2)}%`],
    ];

    autoTable(doc, {
      startY: 55,
      head: [metricsData[0]],
      body: metricsData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.setFontSize(14);
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.text('Transações', 14, finalY + 10);

    const transactionsData = validFilteredTransactions.map((t) => [
      format(new Date(t.date), 'dd/MM/yyyy'),
      t.description,
      t.category,
      t.type === 'income' ? 'Receita' : 'Despesa',
      formatCurrency(t.amount),
    ]);

    autoTable(doc, {
      startY: finalY + 15,
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
      body: transactionsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 60 },
        4: { halign: 'right' },
      },
    });

    doc.save(`Relatorio_Financeiro_${periodLabel}_${format(new Date(), 'ddMMyyyy')}.pdf`);

    toast({
      title: 'Exportado com sucesso',
      description: 'Relatório exportado para PDF.',
    });
  }, [validFilteredTransactions, totalIncome, totalExpense, balance, profitMargin, averageTicket, growthRate, periodFilter, formatCurrency, toast]);

  // RENDERIZAÇÃO CONDICIONAL (sem retornos antecipados que quebrem hooks)
  if (roleLoading || permLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (!isAdmin || !hasFinancialAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Lock className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você não tem permissão para acessar os relatórios financeiros.
            Entre em contato com um administrador para solicitar acesso.
          </p>
        </div>
      </Layout>
    );
  }

  // Só mostrar loading se não tiver NENHUM dado (nem cache) E for primeira carga manual
  const hasNoData = transactions.length === 0 && !initialCache;
  if (hasNoData && isRefreshing) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados financeiros...</p>
          <p className="text-xs text-muted-foreground">Isso pode levar alguns minutos na primeira vez</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              Financeiro
            </h1>
            <p className="text-muted-foreground mt-2">
              Acompanhe suas transações e relatórios financeiros
            </p>
            <div className="mt-2 flex items-center gap-4">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
              {isFromCache && lastUpdate && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Cache de {format(lastUpdate, "dd/MM HH:mm", { locale: ptBR })}
                </Badge>
              )}
              {isRefreshing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Atualizando...</span>
                </div>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            disabled={isRefreshing}
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setTransactions([]);
              toast({
                title: 'Cache limpo',
                description: 'Buscando dados dos últimos 24 meses...',
              });
              fetchTransactions(true, true); // Força refresh com loading visível
            }}
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Atualizar dados
          </Button>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}


        {filteredTransactions.length !== validFilteredTransactions.length && validFilteredTransactions.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Transações com datas inválidas</AlertTitle>
            <AlertDescription>
              {filteredTransactions.length - validFilteredTransactions.length} {filteredTransactions.length - validFilteredTransactions.length === 1 ? 'transação foi ignorada' : 'transações foram ignoradas'} por conter dados de data inválidos ou ausentes.
            </AlertDescription>
          </Alert>
        )}

        {/* Filtros de Período */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período para visualização</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <label className="text-sm font-medium">Período:</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="quarter">Trimestre atual</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Executivo com KPIs e Metas */}
        <ExecutiveDashboard
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          profitMargin={profitMargin}
          period={periodFilter}
        />

        {/* Sistema de Alertas */}
        <FinancialAlerts
          totalExpense={totalExpense}
          profitMargin={profitMargin}
          growthRate={growthRate}
          period={periodFilter}
        />

        {/* Inadimplentes */}
        <FinancialDefaulters transactions={filteredTransactions} />

        {/* Link para Gestão de Cobranças */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sistema de Gestão de Cobranças
            </CardTitle>
            <CardDescription>
              Acesse o dashboard completo de cobranças automáticas, histórico de mensagens e configuração de regras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/gestao-cobrancas">
              <Button className="w-full sm:w-auto">
                Acessar Gestão de Cobranças
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Fluxo de Caixa Projetado */}
        <CashFlowProjection transactions={filteredTransactions} />

        {/* Análise Preditiva */}
        <FinancialPredictions transactions={filteredTransactions} />

        {/* Gráficos de Distribuição por Categoria */}
        <FinancialDistribution transactions={filteredTransactions} />

        {/* Gráfico de Evolução */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evolução Temporal</CardTitle>
              <CardDescription>Receitas e despesas ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  receitas: {
                    label: 'Receitas',
                    color: 'hsl(var(--chart-1))',
                  },
                  despesas: {
                    label: 'Despesas',
                    color: 'hsl(var(--chart-2))',
                  },
                }}
                className="h-[400px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => 
                        new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(value)
                      }
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="receitas" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="despesas" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalIncome)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpense)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard de Métricas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Indicadores de Performance</CardTitle>
                <CardDescription>Métricas financeiras detalhadas do período selecionado</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToExcel} variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Margem de Lucro */}
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4 text-primary" />
                    Margem de Lucro
                  </CardTitle>
                  <CardDescription>Rentabilidade das operações</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profitMargin.toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {profitMargin >= 20 ? 'Excelente' : profitMargin >= 10 ? 'Boa' : profitMargin >= 0 ? 'Razoável' : 'Atenção necessária'}
                  </p>
                </CardContent>
              </Card>

              {/* Ticket Médio */}
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Ticket Médio
                  </CardTitle>
                  <CardDescription>Valor médio por receita</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(averageTicket)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {filteredTransactions.filter((t) => t.type === 'income').length} transações de receita
                  </p>
                </CardContent>
              </Card>

              {/* Taxa de Crescimento */}
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Taxa de Crescimento
                  </CardTitle>
                  <CardDescription>
                    {periodFilter === 'month' ? 'vs. mês anterior' :
                     periodFilter === 'quarter' ? 'vs. trimestre anterior' :
                     periodFilter === 'year' ? 'vs. ano anterior' : 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold flex items-center gap-2 ${
                    growthRate > 0 ? 'text-green-600' : growthRate < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {growthRate > 0 && <TrendingUp className="h-6 w-6" />}
                    {growthRate < 0 && <TrendingDown className="h-6 w-6" />}
                    {growthRate > 0 ? '+' : ''}{growthRate.toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {periodFilter === 'all' ? 'Selecione um período específico' :
                     growthRate > 10 ? 'Crescimento forte' :
                     growthRate > 0 ? 'Crescimento moderado' :
                     growthRate === 0 ? 'Estável' : 'Declínio'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
            <CardDescription>
              {validFilteredTransactions.length} {validFilteredTransactions.length === 1 ? 'transação' : 'transações'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {validFilteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {validFilteredTransactions.map((transaction) => (
                    <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {transaction.type === 'income' ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <p className="font-semibold">{transaction.description}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                              <Badge variant="outline" className="text-xs">
                                {transaction.category}
                              </Badge>
                            </div>
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

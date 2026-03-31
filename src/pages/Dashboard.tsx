import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, MessageSquare, TrendingUp, User, Mail, Users, Video, Building2, ExternalLink, Gavel, Clock, Cake, Megaphone, Calendar, Trophy, Pin, Search, Star, Zap, Home, Palmtree, CalendarOff, Calculator } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskNotifications } from '@/components/TaskNotifications';
import { BirthdayMessageFailuresAlert } from '@/components/BirthdayMessageFailuresAlert';
import { getTopAccessedPages } from '@/hooks/useAccessTracking';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { tutorialsByPage } from '@/components/tutorialData';

interface BirthdayProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  birth_date: string;
  position: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'comunicado' | 'evento' | 'conquista';
  is_pinned: boolean;
  created_at: string;
}

interface TopPage {
  page_path: string;
  page_name: string;
  access_count: number;
}

interface AbsenceRecord {
  id: string;
  full_name: string;
  avatar_url: string | null;
  tipo: 'home_office' | 'folga' | 'ferias';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading, isApproved } = useUserRole();
  const [monthBirthdays, setMonthBirthdays] = useState<BirthdayProfile[]>([]);
  const [loadingBirthdays, setLoadingBirthdays] = useState(true);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loadingTopPages, setLoadingTopPages] = useState(true);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [loadingAbsences, setLoadingAbsences] = useState(true);

  useEffect(() => {
    fetchMonthBirthdays();
    fetchRecentAnnouncements();
    fetchAbsences();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchTopPages();
    }
  }, [profile?.id]);

  const fetchTopPages = async () => {
    if (!profile?.id) return;
    const pages = await getTopAccessedPages(profile.id, 6);
    setTopPages(pages);
    setLoadingTopPages(false);
  };

  const fetchMonthBirthdays = async () => {
    const currentMonth = new Date().getMonth(); // 0-indexed
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, birth_date, position')
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .eq('is_suspended', false)
      .not('birth_date', 'is', null);

    if (!error && data) {
      const filtered = data.filter((p) => {
        if (p.birth_date) {
          // Parse date string manually to avoid timezone issues
          const [year, month] = p.birth_date.split('-').map(Number);
          return (month - 1) === currentMonth; // month is 1-indexed in string
        }
        return false;
      });

      // Ordenar por dia do mês
      filtered.sort((a, b) => {
        // Extract day directly from string to avoid timezone issues
        const dayA = parseInt(a.birth_date!.split('-')[2], 10);
        const dayB = parseInt(b.birth_date!.split('-')[2], 10);
        return dayA - dayB;
      });

      setMonthBirthdays(filtered as BirthdayProfile[]);
    }
    setLoadingBirthdays(false);
  };

  const fetchRecentAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, type, is_pinned, created_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setRecentAnnouncements(data as Announcement[]);
    }
    setLoadingAnnouncements(false);
  };

  const fetchAbsences = async () => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const dayOfWeek = today.getDay();
      const absMonth = today.getMonth() + 1;
      const absYear = today.getFullYear();
      const currentYear = today.getFullYear();

      const [hoRes, folgaRes, feriasRes] = await Promise.all([
        supabase
          .from('home_office_schedules')
          .select('user_id')
          .eq('day_of_week', dayOfWeek)
          .eq('month', absMonth)
          .eq('year', absYear),
        supabase
          .from('rh_folgas')
          .select('colaborador_id')
          .eq('data_folga', todayStr),
        supabase
          .from('vacation_requests')
          .select('user_id')
          .eq('status', 'approved')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
      ]);

      const absenceMap = new Map<string, AbsenceRecord['tipo']>();
      (hoRes.data || []).forEach((r: any) => absenceMap.set(r.user_id, 'home_office'));
      (folgaRes.data || []).forEach((r: any) => { if (!absenceMap.has(r.colaborador_id)) absenceMap.set(r.colaborador_id, 'folga'); });
      (feriasRes.data || []).forEach((r: any) => { if (!absenceMap.has(r.user_id)) absenceMap.set(r.user_id, 'ferias'); });

      if (absenceMap.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(absenceMap.keys()))
          .eq('is_active', true)
          .eq('is_suspended', false);

        const result: AbsenceRecord[] = (profiles || []).map(p => ({
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          tipo: absenceMap.get(p.id)!,
        }));
        result.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setAbsences(result);
      }
    } catch (err) {
      console.error('Erro ao buscar ausências:', err);
    } finally {
      setLoadingAbsences(false);
    }
  };

  const getPositionLabel = (position: string | null) => {
    if (!position) return '';
    const positions: { [key: string]: string } = {
      socio: 'Sócio',
      advogado: 'Advogado',
      estagiario: 'Estagiário',
      comercial: 'Comercial',
      administrativo: 'Administrativo',
    };
    return positions[position] || position;
  };

  const getAnnouncementTypeInfo = (type: Announcement['type']) => {
    const types = {
      comunicado: { label: 'Comunicado', icon: Megaphone, color: 'bg-blue-500' },
      evento: { label: 'Evento', icon: Calendar, color: 'bg-green-500' },
      conquista: { label: 'Conquista', icon: Trophy, color: 'bg-amber-500' },
    };
    return types[type];
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isApproved) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {profile?.approval_status === 'pending' && (
                'Seu cadastro está aguardando aprovação de um administrador. Você receberá acesso em breve.'
              )}
              {profile?.approval_status === 'rejected' && (
                'Seu cadastro foi rejeitado. Entre em contato com o administrador para mais informações.'
              )}
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const tools = [
    {
      title: 'Assistente de IA',
      description: 'Converse com diferentes modelos de IA',
      icon: TrendingUp,
      path: '/assistente-ia',
    },
    {
      title: 'RotaDoc',
      description: 'Rotação e Organização Inteligente de Documentos',
      icon: FileText,
      path: '/tools/rotadoc',
    },
    {
      title: 'Pesquisa de Jurisprudência',
      description: 'Busque decisões judiciais com IA',
      icon: Search,
      path: '/pesquisa-jurisprudencia',
    },
    {
      title: 'Agentes de IA',
      description: 'Assistentes inteligentes para seu trabalho',
      icon: TrendingUp,
      path: '/agentes-ia',
    },
    {
      title: 'Sugestões',
      description: 'Envie melhorias para a intranet e escritório',
      icon: TrendingUp,
      path: '/sugestoes',
    },
    {
      title: 'Fórum',
      description: 'Discussões e conversas da equipe',
      icon: MessageSquare,
      path: '/forum',
    },
  ];

  const toolLinks = [
    { icon: FileText, url: 'https://app.advbox.com.br/login', label: 'Advbox', description: 'Gestão Processual' },
    { icon: MessageSquare, url: 'https://s17.chatguru.app/', label: 'ChatGuru', description: 'Sistema de WhatsApp' },
    { icon: Users, url: 'https://accounts.rdstation.com/?locale=pt-BR&trial_origin=rds--header-login', label: 'RD Station CRM', description: 'CRM' },
    { icon: Mail, url: 'https://outlook.office.com/mail/', label: 'E-mail', description: 'Outlook' },
    { icon: Video, url: 'https://teams.microsoft.com/v2/', label: 'Microsoft Teams', description: 'Arquivos, Reuniões e Chat' },
    { icon: Building2, url: 'https://credlocaliza.com.br/', label: 'Credlocaliza', description: 'Consultas' },
    { icon: Gavel, url: 'https://www.jusbrasil.com.br/', label: 'JusBrasil', description: 'Pesquisa Jurídica' },
    { icon: MessageSquare, url: 'https://chat.openai.com/', label: 'ChatGPT', description: 'Inteligência Artificial' },
    { icon: Calculator, url: 'https://www.jfrs.jus.br/projefweb/', label: 'ProjefWeb', description: 'Sistema de Cálculos TRF4' },
  ];

  return (
    <Layout>
      <div className="space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-8 border border-primary/20 shadow-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(221_83%_53%/0.1),transparent_50%)]"></div>
          <div className="relative flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24 border-4 border-primary/30 shadow-lg">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl">
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/profile')}
                className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
              >
                Editar perfil
              </Button>
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                Olá, {profile?.full_name?.split(' ')[0]}!
              </h1>
              <p className="text-foreground/80 text-lg mb-3">
                Seja bem-vindo à Intranet Egg Nunes! Acesse suas ferramentas e recursos.
              </p>
              <div className="flex items-center gap-2 mb-1">
                <TutorialOverlay
                  pageKey="dashboard"
                  pageName={tutorialsByPage.dashboard.pageName}
                  steps={tutorialsByPage.dashboard.steps}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-sm">
                  {profile?.position === 'socio' && 'Sócio'}
                  {profile?.position === 'advogado' && 'Advogado'}
                  {profile?.position === 'estagiario' && 'Estagiário'}
                  {profile?.position === 'comercial' && 'Comercial'}
                  {profile?.position === 'administrativo' && 'Administrativo'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Atalhos Personalizados - Páginas mais acessadas */}
        {topPages.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20">
                  <Zap className="h-5 w-5 text-yellow-600" />
                </div>
                Acesso Rápido
              </h2>
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                Baseado no seu uso
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {topPages.map((page, idx) => (
                <Card
                  key={page.page_path}
                  className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-l-2 border-l-yellow-500/50 bg-gradient-to-br from-yellow-50/50 to-amber-50/30 dark:from-yellow-950/20 dark:to-amber-950/10"
                  onClick={() => navigate(page.page_path)}
                >
                  <CardContent className="p-3">
                    <p className="font-medium text-sm truncate">{page.page_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {page.access_count} {page.access_count === 1 ? 'acesso' : 'acessos'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Alertas de Tarefas */}
        <TaskNotifications />

        {/* Alertas de Falhas de Mensagens de Aniversário */}
        <BirthdayMessageFailuresAlert />

        {/* Quem não está no escritório hoje */}
        {!loadingAbsences && absences.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
                <CalendarOff className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold">Quem não está no escritório hoje</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {absences.map((a) => (
                <Card key={a.id} className="border-l-4 border-l-orange-400">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={a.avatar_url || undefined} />
                      <AvatarFallback className="text-sm">
                        {a.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.full_name}</p>
                    </div>
                    <Badge variant={a.tipo === 'ferias' ? 'default' : 'secondary'} className="flex items-center gap-1 shrink-0">
                      {a.tipo === 'home_office' && <><Home className="h-3 w-3" /> Home Office</>}
                      {a.tipo === 'folga' && <><CalendarOff className="h-3 w-3" /> Folga</>}
                      {a.tipo === 'ferias' && <><Palmtree className="h-3 w-3" /> Férias</>}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Mural de Avisos - Destaques */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Megaphone className="h-5 w-5 text-amber-600" />
              </div>
              Avisos Recentes
            </h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/mural-avisos')}>
              Ver todos
            </Button>
          </div>
          {loadingAnnouncements ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Carregando avisos...</p>
            </div>
          ) : recentAnnouncements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum aviso cadastrado ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentAnnouncements.map((announcement) => {
                const typeInfo = getAnnouncementTypeInfo(announcement.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <Card 
                    key={announcement.id}
                    className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-l-4 border-l-amber-500"
                    onClick={() => navigate('/mural-avisos')}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${typeInfo.color} text-white`}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">{typeInfo.label}</Badge>
                            {announcement.is_pinned && (
                              <Badge variant="outline" className="gap-1">
                                <Pin className="h-3 w-3" />
                                Fixado
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg line-clamp-2">{announcement.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">{announcement.content}</p>
                      <p className="text-xs text-muted-foreground mt-3">
                        {format(new Date(announcement.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Separator className="my-8" />

        {/* Ferramentas */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Ferramentas da Intranet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool, idx) => {
              const colors = [
                'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10 hover:border-violet-500/40 hover:shadow-violet-500/20',
                'from-purple-500/10 to-pink-500/5 hover:from-purple-500/20 hover:to-pink-500/10 hover:border-purple-500/40 hover:shadow-purple-500/20',
                'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 hover:border-blue-500/40 hover:shadow-blue-500/20',
                'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10 hover:border-emerald-500/40 hover:shadow-emerald-500/20',
                'from-pink-500/10 to-pink-600/5 hover:from-pink-500/20 hover:to-pink-600/10 hover:border-pink-500/40 hover:shadow-pink-500/20',
                'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10 hover:border-cyan-500/40 hover:shadow-cyan-500/20',
              ];
              const iconColors = [
                'text-violet-600',
                'text-purple-600',
                'text-blue-600',
                'text-emerald-600',
                'text-pink-600',
                'text-cyan-600',
              ];
              return (
                <Card
                  key={tool.path}
                  className={`bg-gradient-to-br ${colors[idx]} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border group`}
                  onClick={() => navigate(tool.path)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-white/80 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <tool.icon className={`h-5 w-5 ${iconColors[idx]}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {tool.title}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {tool.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Links Úteis */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <ExternalLink className="h-5 w-5 text-primary" />
            </div>
            Links Úteis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {toolLinks.map((tool) => (
              <Card key={tool.url} className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                <a href={tool.url} target="_blank" rel="noopener noreferrer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <tool.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">{tool.label}</h3>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </a>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Aniversariantes do Mês */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20">
                <Cake className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Aniversariantes do Mês</h2>
                <p className="text-sm text-muted-foreground">Celebre com a equipe</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/aniversarios')} className="gap-2">
              Ver todos
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          
          {loadingBirthdays ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Carregando aniversariantes...
              </CardContent>
            </Card>
          ) : monthBirthdays.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum aniversariante este mês.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthBirthdays.map((person) => (
                <Card
                  key={person.id}
                  className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 hover:from-pink-500/20 hover:to-rose-500/10 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-pink-200/50"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-pink-400/50">
                        <AvatarImage src={person.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-pink-400/20 to-rose-400/20">
                          <User className="h-8 w-8 text-pink-600" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg truncate">{person.full_name}</p>
                        <p className="text-sm text-pink-700 font-medium">
                          {(() => {
                            const [year, month, day] = person.birth_date.split('-').map(Number);
                            const date = new Date(year, month - 1, day, 12, 0, 0);
                            return format(date, "dd 'de' MMMM", { locale: ptBR });
                          })()}
                        </p>
                        {person.position && (
                          <Badge variant="outline" className="mt-2 text-xs border-pink-400 text-pink-700">
                            {getPositionLabel(person.position)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

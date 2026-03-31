import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';
import {
  Users, Eye, TrendingUp, Heart, MessageCircle, Image, Video, ExternalLink, UserPlus,
  AlertTriangle, Settings, Instagram
} from 'lucide-react';

interface InstagramTabProps {
  dateRange: { from: Date; to: Date };
}

function NotConfiguredState({ errorMessage }: { errorMessage?: string }) {
  return (
    <Card className="border-amber-500/50">
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
          <div className="p-3 rounded-full bg-amber-500/10">
            <Instagram className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Instagram não configurado</h3>
          {errorMessage && (
            <Alert variant="destructive" className="text-left">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro retornado</AlertTitle>
              <AlertDescription className="text-xs break-words">{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="text-sm text-muted-foreground space-y-3 text-left w-full">
            <p className="font-medium text-foreground">Para ativar os insights do Instagram:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Token de acesso Meta válido</strong>: Vá em <em>Integrações → Meta Ads</em> e salve seu token de acesso. O token deve ter as seguintes permissões:
                <ul className="list-disc list-inside ml-4 mt-1 text-xs text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">instagram_basic</code></li>
                  <li><code className="bg-muted px-1 rounded">instagram_manage_insights</code></li>
                  <li><code className="bg-muted px-1 rounded">pages_show_list</code></li>
                </ul>
              </li>
              <li>
                <strong>Conta Instagram Business</strong>: Sua conta do Instagram precisa ser do tipo Business ou Creator, vinculada a uma Página do Facebook.
              </li>
              <li>
                <strong>Página do Facebook conectada</strong>: A Página do Facebook deve estar associada à conta Instagram nas configurações do Facebook.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground/80 mt-2">
              Após configurar, recarregue esta página para ver os dados do Instagram.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InstagramTab({ dateRange }: InstagramTabProps) {
  const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const dateTo = format(dateRange.to, 'yyyy-MM-dd');

  const { data: accountInfo, isLoading: loadingAccount, error: accountError } = useQuery({
    queryKey: ['instagram-account-info'],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('instagram-insights', {
        body: { action: 'account_info' },
      });
      if (resp.error) {
        const msg = resp.error.message || resp.error?.context?.body || 'Falha ao conectar com a função de Instagram. Verifique se a função está ativa.';
        throw new Error(msg);
      }
      if (resp.data?.error) throw new Error(resp.data.error);
      if (!resp.data?.account) throw new Error('Nenhum dado de conta retornado. Verifique a configuração do Instagram.');
      return resp.data.account;
    },
    retry: 1,
  });

  const { data: dailyInsights = [], isLoading: loadingDaily } = useQuery({
    queryKey: ['instagram-daily-insights', dateFrom, dateTo],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('instagram-insights', {
        body: { action: 'daily_insights', date_from: dateFrom, date_to: dateTo },
      });
      if (resp.error) throw new Error(resp.error.message || 'Erro ao buscar insights diários');
      if (resp.data?.error) throw new Error(resp.data.error);
      return resp.data?.daily || [];
    },
    enabled: !!accountInfo,
  });

  const { data: topPosts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ['instagram-top-posts'],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('instagram-insights', {
        body: { action: 'top_engaged' },
      });
      if (resp.error) throw new Error(resp.error.message || 'Erro ao buscar top posts');
      if (resp.data?.error) throw new Error(resp.data.error);
      return resp.data?.top_posts || [];
    },
    enabled: !!accountInfo,
  });

  const chartData = useMemo(() => dailyInsights.map((d: any) => ({
    data: format(new Date(d.date), 'dd/MM'),
    impressoes: d.views || 0,
    alcance: d.reach || 0,
    seguidores: d.follower_count || 0,
    visitas: d.profile_views || 0,
  })), [dailyInsights]);

  const totals = useMemo(() => {
    const t = { impressions: 0, reach: 0, profileViews: 0, followerGrowth: 0 };
    for (const d of dailyInsights) {
      t.impressions += d.impressions || 0;
      t.reach += d.reach || 0;
      t.profileViews += d.profile_views || 0;
    }
    if (dailyInsights.length >= 2) {
      const first = dailyInsights[0]?.follower_count || 0;
      const last = dailyInsights[dailyInsights.length - 1]?.follower_count || 0;
      t.followerGrowth = last - first;
    }
    return t;
  }, [dailyInsights]);

  if (accountError) {
    const errMsg = (accountError as Error).message || '';
    const isNotConfigured = errMsg.includes('não configurado') || errMsg.includes('não encontrada') || errMsg.includes('Nenhum dado') || errMsg.includes('Failed to send');
    if (isNotConfigured) {
      return <NotConfiguredState errorMessage={errMsg} />;
    }
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-destructive font-medium">Erro ao carregar Instagram</p>
            <p className="text-sm text-muted-foreground max-w-md">{errMsg}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Verifique se o token do Meta Ads possui as permissões: <strong>instagram_basic</strong>, <strong>instagram_manage_insights</strong> e <strong>pages_show_list</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loadingAccount) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accountInfo && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {accountInfo.profile_picture_url && (
                <img src={accountInfo.profile_picture_url} alt={accountInfo.name} className="w-20 h-20 rounded-full border-2 border-primary/20" />
              )}
              <div className="text-center sm:text-left flex-1">
                <h3 className="text-lg font-bold text-foreground">{accountInfo.name}</h3>
                <p className="text-sm text-muted-foreground">@{accountInfo.username}</p>
                {accountInfo.biography && <p className="text-sm text-foreground/80 mt-1 max-w-md">{accountInfo.biography}</p>}
                {accountInfo.website && (
                  <a href={accountInfo.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 justify-center sm:justify-start">
                    <ExternalLink className="h-3 w-3" />{accountInfo.website}
                  </a>
                )}
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-xl font-bold text-foreground">{(accountInfo.followers_count || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Seguidores</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{(accountInfo.follows_count || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Seguindo</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{(accountInfo.media_count || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <UserPlus className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Crescimento</div>
            <div className={`text-lg font-bold ${totals.followerGrowth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {totals.followerGrowth >= 0 ? '+' : ''}{totals.followerGrowth.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Eye className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Impressões</div>
            <div className="text-lg font-bold text-foreground">{totals.impressions.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Alcance</div>
            <div className="text-lg font-bold text-foreground">{totals.reach.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Visitas ao Perfil</div>
            <div className="text-lg font-bold text-foreground">{totals.profileViews.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
      </div>

      {loadingDaily ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Seguidores</CardTitle>
              <CardDescription className="text-xs">Evolução no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Seguidores" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Alcance e Impressões</CardTitle>
              <CardDescription className="text-xs">Diário no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="alcance" fill="hsl(215, 80%, 55%)" name="Alcance" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="impressoes" fill="hsl(340, 75%, 55%)" name="Impressões" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum dado de insights disponível para o período selecionado.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Top 10 Posts Mais Engajados
          </CardTitle>
          <CardDescription className="text-xs">Posts com maior número de curtidas + comentários</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPosts ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : topPosts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {topPosts.map((post: any, idx: number) => (
                <a key={post.id} href={post.permalink} target="_blank" rel="noopener noreferrer" className="group block rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors">
                  <div className="relative aspect-square bg-muted">
                    {post.media_url ? (
                      post.media_type === 'VIDEO' ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Video className="h-8 w-8 text-muted-foreground" />
                          {post.thumbnail_url && <img src={post.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                        </div>
                      ) : (
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0" variant="secondary">#{idx + 1}</Badge>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5 text-pink-500"><Heart className="h-3 w-3" />{(post.like_count || 0).toLocaleString('pt-BR')}</span>
                      <span className="flex items-center gap-0.5 text-muted-foreground"><MessageCircle className="h-3 w-3" />{(post.comments_count || 0).toLocaleString('pt-BR')}</span>
                    </div>
                    {post.caption && <p className="text-[10px] text-muted-foreground line-clamp-2">{post.caption}</p>}
                    <p className="text-[10px] text-muted-foreground/60">{format(new Date(post.timestamp), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum post encontrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API = 'https://graph.facebook.com/v25.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('Missing environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Erro de configuração do servidor. Variáveis de ambiente ausentes.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = user.id;

    const body = await req.json();
    const { action, date_from, date_to } = body;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: config, error: configError } = await serviceClient
      .from('meta_ads_config')
      .select('access_token, ad_account_id, instagram_account_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (configError || !config?.access_token) {
      console.log('No meta_ads_config found for user:', userId, configError?.message);
      return new Response(JSON.stringify({ error: 'Meta Ads não configurado. Salve suas credenciais em Integrações → Meta Ads primeiro. O token precisa das permissões: instagram_basic, instagram_manage_insights, pages_show_list.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = config.access_token;
    let igAccountId = config.instagram_account_id;

    // Auto-discover IG account if not set
    if (!igAccountId) {
      console.log('Auto-discovering Instagram Business Account...');
      const pagesResp = await fetch(`${META_API}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`);
      const pagesData = await pagesResp.json();

      if (pagesData.error) {
        console.error('Meta API error fetching pages:', JSON.stringify(pagesData.error));
        return new Response(JSON.stringify({
          error: `Erro da API Meta ao buscar páginas: ${pagesData.error.message || 'Erro desconhecido'}. Verifique se o token possui as permissões instagram_basic, instagram_manage_insights e pages_show_list.`,
          meta_error: pagesData.error,
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      for (const page of (pagesData.data || [])) {
        if (page.instagram_business_account?.id) {
          igAccountId = page.instagram_business_account.id;
          await serviceClient
            .from('meta_ads_config')
            .update({ instagram_account_id: igAccountId })
            .eq('user_id', userId)
            .eq('is_active', true);
          console.log('Discovered IG account:', igAccountId);
          break;
        }
      }

      if (!igAccountId) {
        return new Response(JSON.stringify({ error: 'Nenhuma conta Instagram Business vinculada encontrada. Certifique-se de que sua página do Facebook está conectada a uma conta Instagram Business.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    async function metaFetch(url: string) {
      console.log('Fetching Meta API:', url.replace(accessToken, '***'));
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) {
        console.error('Meta API error:', JSON.stringify(data.error));
        throw new Error(data.error.message || 'Erro da API Meta');
      }
      return data;
    }

    const toDate = date_to || new Date().toISOString().split('T')[0];
    const maxMs = 28 * 86400000; // Meta API: max ~30 days, usar 28 por segurança
    let fromDate = date_from || new Date(Date.now() - maxMs).toISOString().split('T')[0];
    // Clamp: garantir que nunca exceda 28 dias
    if (new Date(toDate).getTime() - new Date(fromDate).getTime() > maxMs) {
      fromDate = new Date(new Date(toDate).getTime() - maxMs).toISOString().split('T')[0];
      console.log('Clamped fromDate to', fromDate, 'to stay within 28-day limit');
    }

    if (action === 'account_info') {
      const data = await metaFetch(
        `${META_API}/${igAccountId}?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${accessToken}`
      );
      return new Response(JSON.stringify({ account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'media') {
      const limit = body.limit || 50;
      const data = await metaFetch(
        `${META_API}/${igAccountId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,media_url,thumbnail_url,permalink&limit=${limit}&access_token=${accessToken}`
      );
      return new Response(JSON.stringify({ media: data.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'top_engaged') {
      const data = await metaFetch(
        `${META_API}/${igAccountId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,media_url,thumbnail_url,permalink&limit=100&access_token=${accessToken}`
      );
      const media = (data.data || [])
        .map((m: any) => ({ ...m, engagement: (m.like_count || 0) + (m.comments_count || 0) }))
        .sort((a: any, b: any) => b.engagement - a.engagement)
        .slice(0, 10);
      return new Response(JSON.stringify({ top_posts: media }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'daily_insights') {
      const since = Math.floor(new Date(fromDate).getTime() / 1000);
      const until = Math.floor(new Date(toDate).getTime() / 1000) + 86400;

      console.log('Fetching Instagram daily insights with split metric types', {
        igAccountId,
        fromDate,
        toDate,
        since,
        until,
      });

      const [timeSeriesData, totalValueData] = await Promise.all([
        metaFetch(
          `${META_API}/${igAccountId}/insights?metric=reach,follower_count&period=day&metric_type=time_series&since=${since}&until=${until}&access_token=${accessToken}`
        ),
        metaFetch(
          `${META_API}/${igAccountId}/insights?metric=profile_views,views&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${accessToken}`
        ),
      ]);

      const dailyMap: Record<string, any> = {};

      // Process time_series metrics (reach, follower_count) - these have values[] array with end_time per day
      for (const metric of (timeSeriesData.data || [])) {
        if (Array.isArray(metric.values)) {
          for (const entry of metric.values) {
            const date = entry.end_time?.split('T')[0];
            if (!date) continue;
            if (!dailyMap[date]) dailyMap[date] = { date };
            dailyMap[date][metric.name] = typeof entry.value === 'number' ? entry.value : 0;
          }
        }
      }

      // Process total_value metrics (profile_views, views) - these have total_value.value (single number for the whole period)
      // Distribute evenly across all days we already have from time_series
      const allDates = Object.keys(dailyMap).sort();
      const numDays = allDates.length || 1;

      for (const metric of (totalValueData.data || [])) {
        const totalVal = metric.total_value?.value;
        const val = typeof totalVal === 'number' ? totalVal : 0;
        const perDay = Math.round(val / numDays);
        const remainder = val - (perDay * numDays);

        console.log(`Total value metric "${metric.name}": total=${val}, perDay=${perDay}, days=${numDays}`);

        for (let i = 0; i < allDates.length; i++) {
          const date = allDates[i];
          if (!dailyMap[date]) dailyMap[date] = { date };
          // Give remainder to the last day
          dailyMap[date][metric.name] = perDay + (i === allDates.length - 1 ? remainder : 0);
        }
      }

      const daily = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

      console.log('Instagram daily insights combined successfully', {
        days: daily.length,
        metrics: {
          time_series: (timeSeriesData.data || []).map((metric: any) => metric.name),
          total_value: (totalValueData.data || []).map((metric: any) => metric.name),
        },
      });

      return new Response(JSON.stringify({ daily }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação não suportada: ' + action }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Instagram insights error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

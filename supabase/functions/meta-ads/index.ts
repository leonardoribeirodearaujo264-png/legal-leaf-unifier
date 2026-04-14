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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const body = await req.json();
    const { action, date_from, date_to } = body;

    // Fetch credentials from meta_ads_config
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: config } = await serviceClient
      .from('meta_ads_config')
      .select('access_token, ad_account_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ error: 'Meta Ads não configurado. Salve suas credenciais primeiro.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalToken = config.access_token;
    const actId = config.ad_account_id.startsWith('act_') ? config.ad_account_id : `act_${config.ad_account_id}`;

    const fromDate = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = date_to || new Date().toISOString().split('T')[0];

    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const metaFetch = async (url: string) => {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) {
        console.error('Meta API error:', data.error);
        return json({ error: data.error.message }, 400);
      }
      return data;
    };

    // ==================== READ ACTIONS ====================

    if (action === 'campaigns') {
      const url = `${META_API}/${actId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time,bid_strategy&limit=100&access_token=${finalToken}`;
      const data = await metaFetch(url);
      if (data instanceof Response) return data;
      return json({ campaigns: data.data || [] });
    }

    if (action === 'insights') {
      const url = `${META_API}/${actId}/insights?fields=campaign_name,campaign_id,impressions,clicks,spend,actions,cpc,cpm,ctr,reach,frequency,cost_per_action_type&time_range={"since":"${fromDate}","until":"${toDate}"}&level=campaign&limit=100&access_token=${finalToken}`;
      const data = await metaFetch(url);
      if (data instanceof Response) return data;
      return json({ insights: data.data || [] });
    }

    if (action === 'daily_insights') {
      const url = `${META_API}/${actId}/insights?fields=impressions,clicks,spend,reach,actions,cpc,ctr&time_range={"since":"${fromDate}","until":"${toDate}"}&time_increment=1&level=account&limit=100&access_token=${finalToken}`;
      const data = await metaFetch(url);
      if (data instanceof Response) return data;
      return json({ daily: data.data || [] });
    }

    if (action === 'account_info') {
      const url = `${META_API}/${actId}?fields=name,account_status,currency,balance,amount_spent,business_name&access_token=${finalToken}`;
      const data = await metaFetch(url);
      if (data instanceof Response) return data;
      return json({ account: data });
    }

    // ==================== CAMPAIGN MANAGEMENT ====================

    if (action === 'update_campaign_status') {
      const { campaign_id, new_status } = body;
      if (!campaign_id || !new_status) return json({ error: 'campaign_id e new_status são obrigatórios' }, 400);
      // Valid: ACTIVE, PAUSED, DELETED, ARCHIVED
      const url = `${META_API}/${campaign_id}?access_token=${finalToken}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: new_status }),
      });
      const data = await resp.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true, campaign_id });
    }

    if (action === 'create_campaign') {
      const { name, objective, status: campStatus, daily_budget, lifetime_budget, special_ad_categories } = body;
      if (!name || !objective) return json({ error: 'name e objective são obrigatórios' }, 400);
      const url = `${META_API}/${actId}/campaigns?access_token=${finalToken}`;
      const payload: any = {
        name,
        objective,
        status: campStatus || 'PAUSED',
        special_ad_categories: special_ad_categories || [],
      };
      if (daily_budget) payload.daily_budget = daily_budget;
      if (lifetime_budget) payload.lifetime_budget = lifetime_budget;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true, campaign_id: data.id });
    }

    if (action === 'update_campaign') {
      const { campaign_id, name, daily_budget, lifetime_budget, status: campStatus, bid_strategy } = body;
      if (!campaign_id) return json({ error: 'campaign_id é obrigatório' }, 400);
      const url = `${META_API}/${campaign_id}?access_token=${finalToken}`;
      const payload: any = {};
      if (name) payload.name = name;
      if (daily_budget !== undefined) payload.daily_budget = daily_budget;
      if (lifetime_budget !== undefined) payload.lifetime_budget = lifetime_budget;
      if (campStatus) payload.status = campStatus;
      if (bid_strategy) payload.bid_strategy = bid_strategy;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true });
    }

    if (action === 'delete_campaign') {
      const { campaign_id } = body;
      if (!campaign_id) return json({ error: 'campaign_id é obrigatório' }, 400);
      const url = `${META_API}/${campaign_id}?access_token=${finalToken}`;
      const resp = await fetch(url, { method: 'DELETE' });
      const data = await resp.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true });
    }

    if (action === 'duplicate_campaign') {
      const { campaign_id, new_name } = body;
      if (!campaign_id) return json({ error: 'campaign_id é obrigatório' }, 400);
      // Copy campaign via the API
      const url = `${META_API}/${campaign_id}/copies?access_token=${finalToken}`;
      const payload: any = { status_option: 'PAUSED' };
      if (new_name) payload.rename_options = JSON.stringify({ rename_suffix: ` - ${new_name}` });
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true, copied_campaign_id: data.copied_campaign_id || data.id });
    }

    // ==================== AI ANALYSIS ====================

    if (action === 'ai_analysis') {
      // Build context from insights
      const insightsUrl = `${META_API}/${actId}/insights?fields=campaign_name,campaign_id,impressions,clicks,spend,actions,cpc,cpm,ctr,reach,frequency,cost_per_action_type&time_range={"since":"${fromDate}","until":"${toDate}"}&level=campaign&limit=50&access_token=${finalToken}`;
      const insightsResp = await fetch(insightsUrl);
      const insightsData = await insightsResp.json();
      if (insightsData.error) return json({ error: insightsData.error.message }, 400);

      const insights = insightsData.data || [];

      // Fetch leads from captured_leads for cross-reference
      const { data: leads } = await serviceClient
        .from('captured_leads')
        .select('utm_source, utm_campaign, utm_medium, created_at, name, phone')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .or('utm_source.ilike.%facebook%,utm_source.ilike.%meta%,utm_source.ilike.%instagram%,utm_source.ilike.%fb%')
        .limit(500);

      const leadsCount = leads?.length || 0;

      const summaryText = insights.map((i: any) => {
        const actions = (i.actions || []).map((a: any) => `${a.action_type}: ${a.value}`).join(', ');
        return `Campanha "${i.campaign_name}": ${i.impressions} impressões, ${i.clicks} cliques, CTR ${i.ctr}%, CPC R$${i.cpc}, Gasto R$${i.spend}${actions ? `, Ações: ${actions}` : ''}`;
      }).join('\n');

      const prompt = `Você é um analista de marketing digital especializado em Meta Ads. Analise os seguintes dados de campanhas do período ${fromDate} a ${toDate} e forneça insights acionáveis em português:

DADOS DAS CAMPANHAS:
${summaryText || 'Nenhuma campanha com dados no período.'}

LEADS CAPTURADOS (via Facebook/Instagram/Meta): ${leadsCount} leads no período.

Forneça:
1. **Resumo geral** da performance
2. **Top 3 campanhas** com melhor e pior performance (justifique)
3. **Sugestões de otimização** (orçamento, segmentação, criativos)
4. **Análise de conversão**: custo por lead estimado considerando os ${leadsCount} leads capturados e gasto total
5. **Próximos passos** recomendados

Seja direto, use números e percentuais. Formato Markdown.`;

      // Use Lovable AI
      const aiResp = await fetch('https://igzcajgwqfpcgybxanjo.supabase.co/functions/v1/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ message: prompt, model: 'google/gemini-2.5-flash' }),
      });

      let analysis = '';
      try {
        const aiData = await aiResp.json();
        analysis = aiData?.response || aiData?.content || aiData?.message || 'Não foi possível gerar a análise.';
      } catch {
        analysis = 'Erro ao processar resposta da IA.';
      }

      return json({
        analysis,
        leads_count: leadsCount,
        campaigns_count: insights.length,
        total_spend: insights.reduce((s: number, i: any) => s + parseFloat(i.spend || '0'), 0),
      });
    }

    // ==================== AD-LEVEL INSIGHTS ====================

    if (action === 'ad_insights') {
      const insightsUrl = `${META_API}/${actId}/insights?fields=ad_name,ad_id,adset_name,adset_id,campaign_name,campaign_id,impressions,clicks,spend,actions,ctr,cpc&time_range={"since":"${fromDate}","until":"${toDate}"}&level=ad&limit=500&access_token=${finalToken}`;
      const data = await metaFetch(insightsUrl);
      if (data instanceof Response) return data;

      // Also fetch ad statuses
      const adsUrl = `${META_API}/${actId}/ads?fields=id,name,status,campaign_id,adset_id,adset{name},campaign{name}&limit=500&access_token=${finalToken}`;
      const adsData = await metaFetch(adsUrl);
      const adsStatusMap: Record<string, string> = {};
      if (!(adsData instanceof Response) && adsData.data) {
        for (const ad of adsData.data) {
          adsStatusMap[ad.id] = ad.status;
        }
      }

      const insights = (data.data || []).map((i: any) => ({
        ...i,
        ad_status: adsStatusMap[i.ad_id] || 'UNKNOWN',
      }));

      return json({ ad_insights: insights });
    }

    if (action === 'update_ad_status') {
      const { ad_id, new_status } = body;
      if (!ad_id || !new_status) return json({ error: 'ad_id e new_status são obrigatórios' }, 400);
      const url = `${META_API}/${ad_id}?access_token=${finalToken}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: new_status }),
      });
      const data = await resp.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true, ad_id });
    }

    // ==================== LEADS CROSS-REFERENCE ====================

    if (action === 'leads_meta') {
      const { data: leads } = await serviceClient
        .from('captured_leads')
        .select('*')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .or('utm_source.ilike.%facebook%,utm_source.ilike.%meta%,utm_source.ilike.%instagram%,utm_source.ilike.%fb%')
        .order('created_at', { ascending: false })
        .limit(500);

      return json({ leads: leads || [] });
    }

    return json({ error: 'Ação inválida.' }, 400);

  } catch (error) {
    console.error('meta-ads error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

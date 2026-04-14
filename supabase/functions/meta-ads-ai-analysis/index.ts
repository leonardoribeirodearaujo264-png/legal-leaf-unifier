import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { campaigns_data, totals, leads_count, whatsapp_leads_count, date_from, date_to } = body;

    if (!campaigns_data || !totals) {
      return new Response(JSON.stringify({ error: 'Dados de campanhas são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build detailed prompt
    const campaignsSummary = campaigns_data.map((c: any) => {
      const actionsStr = (c.actions || []).map((a: any) => `${a.action_type}: ${a.value}`).join(', ');
      return `- **${c.name}** (${c.status}): ${c.impressions} impressões, ${c.clicks} cliques, CTR ${c.ctr}%, CPC R$${c.cpc}, Gasto R$${c.spend}, Conversões: ${c.conversions}${actionsStr ? `, Ações: ${actionsStr}` : ''}${c.daily_budget ? `, Budget diário: R$${c.daily_budget}` : ''}`;
    }).join('\n');

    const prompt = `Você é um analista sênior de marketing digital especializado em Meta Ads (Facebook/Instagram Ads) para escritórios de advocacia no Brasil. Analise os dados abaixo do período ${date_from} a ${date_to} e forneça uma análise estratégica completa em português.

## DADOS CONSOLIDADOS
- Impressões totais: ${totals.impressions}
- Alcance total: ${totals.reach}
- Cliques totais: ${totals.clicks}
- CTR médio: ${totals.ctr}%
- CPC médio: R$${totals.cpc}
- Gasto total: R$${totals.spend}
- Conversões totais: ${totals.conversions}
- CPL (Custo por Lead): R$${totals.cpl > 0 ? totals.cpl.toFixed(2) : 'N/A'}

## DADOS POR CAMPANHA
${campaignsSummary || 'Nenhuma campanha com dados no período.'}

## LEADS CAPTURADOS
- Leads via UTM (Facebook/Instagram/Meta): ${leads_count}
- Leads via WhatsApp Business (click-to-whatsapp): ${whatsapp_leads_count}
- Total de leads: ${(leads_count || 0) + (whatsapp_leads_count || 0)}

## ANÁLISE SOLICITADA

Forneça em formato Markdown estruturado:

### 1. 🎯 Diagnóstico de Performance
Avalie a saúde geral das campanhas com base nos KPIs. Compare CTR e CPC com benchmarks do setor jurídico (CTR médio ~1.2%, CPC médio ~R$3-8).

### 2. ✅ Pontos Fortes
Liste as campanhas e métricas que estão acima da média. O que está funcionando bem?

### 3. ⚠️ Pontos Fracos
Identifique campanhas com baixo desempenho, CTR abaixo do esperado, CPC elevado ou baixa conversão.

### 4. 💰 Sugestões de Otimização de Budget
Recomende redistribuição de orçamento entre campanhas. Quais devem receber mais investimento? Quais devem ser pausadas ou reduzidas?

### 5. 🎯 Otimização de Público-Alvo
Sugira ajustes de segmentação, lookalike audiences, exclusões e refinamentos para o nicho jurídico.

### 6. 🎨 Recomendações de Criativos
Sugira melhorias em anúncios: formatos (carrossel, vídeo, stories), copy, CTAs e elementos visuais que funcionam no setor jurídico.

### 7. 📋 Plano de Ação (Próximos 7 dias)
Liste 5-7 ações concretas e priorizadas para melhorar os resultados imediatamente.

Seja direto, use números reais e percentuais. Foque em insights acionáveis.`;

    // Call Anthropic Claude API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errText);

      if (anthropicResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido. Tente novamente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: `Erro na API Claude: ${anthropicResponse.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicData = await anthropicResponse.json();
    const analysis = anthropicData.content?.[0]?.text || 'Não foi possível gerar a análise.';

    // Store analysis in meta_ads_ai_analyses if table exists
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
      await serviceClient.from('meta_ads_ai_analyses').insert({
        user_id: user.id,
        analysis_text: analysis,
        date_from,
        date_to,
        campaigns_count: campaigns_data.length,
        leads_count: (leads_count || 0) + (whatsapp_leads_count || 0),
        total_spend: totals.spend,
        model_used: 'claude-sonnet-4-20250514',
      });
    } catch (e) {
      console.warn('Could not save analysis to history:', e);
    }

    return new Response(JSON.stringify({
      analysis,
      campaigns_count: campaigns_data.length,
      leads_count: (leads_count || 0) + (whatsapp_leads_count || 0),
      total_spend: totals.spend,
      model: 'claude-sonnet-4-20250514',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('meta-ads-ai-analysis error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

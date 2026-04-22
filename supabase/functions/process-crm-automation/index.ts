import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { saveOutboundToWhatsApp } from '../_shared/whatsapp-sync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate caller
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { trigger_type, entity_id, entity_data } = await req.json();

    if (!trigger_type) {
      return new Response(JSON.stringify({ error: 'trigger_type is required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch active rules matching this trigger
    const { data: rules, error: rulesErr } = await supabase
      .from('crm_automation_rules')
      .select('*')
      .eq('trigger_type', trigger_type)
      .eq('is_active', true);

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;

    for (const rule of rules) {
      try {
        // Check trigger conditions
        const config = rule.trigger_config || {};
        if (trigger_type === 'deal_stage_changed' && config.stage_id && entity_data?.stage_id !== config.stage_id) continue;
        if (trigger_type === 'score_reached' && config.min_score && (entity_data?.score || 0) < config.min_score) continue;

        // Execute action
        const actionConfig = rule.action_config || {};
        let actionResult: Record<string, any> = {};

        switch (rule.action_type) {
          case 'send_whatsapp': {
            const template = actionConfig.message_template || 'Olá {{nome}}!';
            const message = template.replace('{{nome}}', entity_data?.name || 'Cliente');
            const phone = entity_data?.phone;
            if (phone) {
              const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
              const zapiToken = Deno.env.get('ZAPI_TOKEN');
              if (zapiInstanceId && zapiToken) {
                const zapiRes = await fetch(
                  `https://api.z-api.io/instances/${zapiInstanceId.trim()}/token/${zapiToken.trim()}/send-text`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN')?.trim() || '' },
                    body: JSON.stringify({ phone: phone.replace(/\D/g, ''), message }),
                  }
                );
                actionResult = { whatsapp_sent: zapiRes.ok, phone };
              } else {
                actionResult = { whatsapp_sent: false, reason: 'Z-API not configured' };
              }
            } else {
              actionResult = { whatsapp_sent: false, reason: 'No phone' };
            }
            break;
          }

          case 'create_task': {
            const { error: taskErr } = await supabase.from('crm_activities').insert({
              title: actionConfig.task_title || 'Tarefa automática',
              type: actionConfig.task_type || 'follow_up',
              contact_id: entity_data?.contact_id || entity_id,
              deal_id: entity_data?.deal_id || null,
              owner_id: entity_data?.owner_id || claimsData.claims.sub,
              priority: 'medium',
              due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              created_by: claimsData.claims.sub,
            });
            actionResult = { task_created: !taskErr, error: taskErr?.message };
            break;
          }

          case 'notify_owner': {
            const ownerId = entity_data?.owner_id || claimsData.claims.sub;
            await supabase.from('user_notifications').insert({
              user_id: ownerId,
              title: `Automação: ${rule.name}`,
              message: `Gatilho "${trigger_type}" acionado para ${entity_data?.name || entity_id}`,
              type: 'crm_automation',
              action_url: '/crm',
            });
            actionResult = { notified: ownerId };
            break;
          }

          case 'change_status': {
            if (entity_id) {
              const newStatus = actionConfig.new_status || 'contacted';
              await supabase.from('crm_contacts').update({ status: newStatus }).eq('id', entity_id);
              actionResult = { status_changed: newStatus };
            }
            break;
          }
        }

        // Log execution
        await supabase.from('crm_automation_log').insert({
          rule_id: rule.id,
          trigger_entity_type: entity_data?.entity_type || 'unknown',
          trigger_entity_id: entity_id || null,
          action_result: actionResult,
          success: true,
        });

        // Update rule stats
        await supabase.from('crm_automation_rules').update({
          executions_count: (rule.executions_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        }).eq('id', rule.id);

        processed++;
      } catch (ruleError: any) {
        await supabase.from('crm_automation_log').insert({
          rule_id: rule.id,
          trigger_entity_type: entity_data?.entity_type || 'unknown',
          trigger_entity_id: entity_id || null,
          success: false,
          error_message: ruleError.message,
        });
      }
    }

    return new Response(JSON.stringify({ processed, total_rules: rules.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

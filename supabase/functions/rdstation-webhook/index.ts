import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const advboxToken = Deno.env.get('ADVBOX_API_TOKEN');
    const webhookSecret = Deno.env.get('RD_STATION_WEBHOOK_SECRET');

    // Validate webhook secret if configured - headers only, no query params
    if (webhookSecret) {
      const receivedSecret = req.headers.get('X-RD-Webhook-Secret') || 
                             req.headers.get('x-rd-webhook-secret') ||
                             req.headers.get('Authorization')?.replace('Bearer ', '');
      
      if (receivedSecret !== webhookSecret) {
        console.error('Invalid webhook secret received');
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid webhook secret' }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      console.log('Webhook secret validated successfully');
    } else {
      console.warn('RD_STATION_WEBHOOK_SECRET not configured - webhook validation disabled');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload from RD Station
    const payload = await req.json();
    console.log('RD Station webhook received:', JSON.stringify(payload, null, 2));

    // Verificar se o negócio foi marcado como "ganho"
    // RD Station envia different estruturas dependendo da configuração
    const dealStage = payload.deal?.deal_stage?.name?.toLowerCase() || 
                      payload.deal_stage?.name?.toLowerCase() || 
                      payload.stage?.name?.toLowerCase() ||
                      '';
    const isWon = payload.deal?.win === true || 
                  payload.win === true ||
                  dealStage.includes('ganho') ||
                  dealStage.includes('ganhou') ||
                  dealStage.includes('won') ||
                  dealStage.includes('fechado') ||
                  dealStage.includes('convertido');

    console.log('Deal stage:', dealStage, 'Is won:', isWon);

    // Se não for um negócio ganho, apenas retornar sucesso sem processar
    if (!isWon) {
      console.log('Deal not won, skipping notifications');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook received but deal not won - no notifications sent',
          deal_stage: dealStage
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // RD Station webhook structure for won deals
    const dealName = payload.deal?.name || payload.name || 'Contrato não identificado';
    const clientName = payload.contact?.name || payload.deal?.contact?.name || 'Cliente';
    const productName = payload.deal?.deal_products?.[0]?.name || payload.product_name || 'Produto não especificado';
    const dealValue = payload.deal?.value || payload.value || 0;

    console.log('Processing WON deal:', { dealName, clientName, productName, dealValue });

    // 1. Buscar todos os usuários administrativos para notificar
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('position', 'administrativo')
      .eq('approval_status', 'approved')
      .eq('is_active', true);

    if (adminError) {
      console.error('Error fetching admin users:', adminError);
    }

    console.log('Administrative users found:', adminUsers?.length || 0);

    // 2. Buscar a Mariana Amorim (coordenadora)
    const { data: marianaUser, error: marianaError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('full_name', '%mariana%amorim%')
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .maybeSingle();

    if (marianaError) {
      console.error('Error fetching Mariana:', marianaError);
    }

    console.log('Mariana found:', marianaUser?.email || 'Not found');

    // 3. Criar notificações para o administrativo
    const adminNotifications = (adminUsers || []).map(user => ({
      user_id: user.id,
      title: '📋 Novo Contrato Fechado',
      message: `O contrato "${dealName}" com ${clientName} foi fechado no RD Station. Por favor, registre o contrato no Advbox.`,
      type: 'contract',
      action_url: '/setor-comercial',
      metadata: {
        deal_name: dealName,
        client_name: clientName,
        product_name: productName,
        deal_value: dealValue,
        source: 'rdstation_webhook'
      }
    }));

    if (adminNotifications.length > 0) {
      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert(adminNotifications);

      if (notifError) {
        console.error('Error creating admin notifications:', notifError);
      } else {
        console.log('Admin notifications created:', adminNotifications.length);
      }
    }

    // 4. Criar tarefa no Advbox para Mariana (se encontrada e se tiver token)
    let advboxTaskCreated = false;
    let advboxTaskId = null;

    if (marianaUser && advboxToken) {
      try {
        // Buscar settings do ADVBox para obter IDs corretos
        let fromUserId = null;
        let taskTypeId = null;
        
        try {
          const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/advbox_settings_cache?setting_key=eq.settings&select=data`, {
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
          });
          if (settingsResponse.ok) {
            const rows = await settingsResponse.json();
            if (rows?.[0]?.data) {
              const settings = rows[0].data;
              const users = settings.users || settings.account?.users || [];
              const tasks = settings.tasks || settings.account?.tasks || [];
              // Buscar Mariana nos usuários do ADVBox
              const marianaAdvbox = users.find((u: any) => 
                (u.name || '').toLowerCase().includes('mariana')
              );
              fromUserId = marianaAdvbox?.id || (users[0]?.id || null);
              // Buscar um tipo de tarefa genérico
              taskTypeId = tasks[0]?.id || tasks[0]?.tasks_id || null;
            }
          }
        } catch (settingsErr) {
          console.warn('Could not fetch settings cache:', settingsErr);
        }

        if (fromUserId && taskTypeId) {
          // Criar tarefa via POST /posts (API v1.2.0)
          const today = new Date();
          const startDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
          const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const deadlineDate = `${String(deadline.getDate()).padStart(2, '0')}/${String(deadline.getMonth() + 1).padStart(2, '0')}/${deadline.getFullYear()}`;

          const taskResponse = await fetch(`https://app.advbox.com.br/api/v1/posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${advboxToken}`,
            },
            body: JSON.stringify({
              from: fromUserId,
              guests: [fromUserId],
              tasks_id: taskTypeId,
              lawsuits_id: 0, // Sem processo vinculado
              start_date: startDate,
              date_deadline: deadlineDate,
              comments: `Contrato fechado no RD Station.\n\nCliente: ${clientName}\nProduto: ${productName}\nValor: R$ ${dealValue?.toLocaleString('pt-BR')}\n\nPor favor, crie as tarefas necessárias (petição inicial, recurso, etc.) e distribua para a equipe.`,
              urgent: true,
              important: true,
            }),
          });

          if (taskResponse.ok) {
            const taskData = await taskResponse.json();
            advboxTaskId = taskData.id || taskData.data?.id;
            advboxTaskCreated = true;
            console.log('Advbox task created via POST /posts:', advboxTaskId);
          } else {
            const errorText = await taskResponse.text();
            console.error('Advbox task creation failed:', errorText);
          }
        } else {
          console.warn('Missing fromUserId or taskTypeId from settings cache, skipping Advbox task creation');
        }
      } catch (advboxError) {
        console.error('Error creating Advbox task:', advboxError);
      }
    }

    // 5. Criar notificação para Mariana sobre a tarefa
    if (marianaUser) {
      const marianaNotification = {
        user_id: marianaUser.id,
        title: '🎯 Nova Tarefa de Coordenação',
        message: `Contrato "${dealName}" fechado com ${clientName}. ${advboxTaskCreated ? 'Uma tarefa foi criada no Advbox.' : 'Por favor, crie as tarefas necessárias no Advbox.'} Distribua as atividades para a equipe (petição inicial, recurso, etc.).`,
        type: 'task',
        action_url: '/tarefas-advbox',
        metadata: {
          deal_name: dealName,
          client_name: clientName,
          product_name: productName,
          deal_value: dealValue,
          advbox_task_id: advboxTaskId,
          source: 'rdstation_webhook'
        }
      };

      const { error: marianaNotifError } = await supabase
        .from('user_notifications')
        .insert(marianaNotification);

      if (marianaNotifError) {
        console.error('Error creating Mariana notification:', marianaNotifError);
      } else {
        console.log('Mariana notification created');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        admin_notifications: adminNotifications.length,
        mariana_notified: !!marianaUser,
        advbox_task_created: advboxTaskCreated
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
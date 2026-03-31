import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_STATION_API_URL = 'https://crm.rdstation.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!rdToken) {
      return new Response(
        JSON.stringify({ error: 'RD_STATION_API_TOKEN não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, data } = await req.json();

    let result: any = {};

    switch (action) {
      case 'sync_pipelines':
        result = await syncPipelines(rdToken, supabase);
        break;
      case 'sync_contacts':
        result = await syncContacts(rdToken, supabase);
        break;
      case 'sync_deals':
        result = await syncDeals(rdToken, supabase);
        break;
      case 'sync_activities':
        result = await syncActivities(rdToken, supabase);
        break;
      case 'full_sync':
        // Get settings ID once upfront
        const { data: settingsRow } = await supabase.from('crm_settings').select('id').single();
        const settingsId = settingsRow?.id;

        const pipelinesResult = await syncPipelines(rdToken, supabase);
        const contactsResult = await syncContacts(rdToken, supabase);
        const dealsResult = await syncDeals(rdToken, supabase);
        
        // Update last sync timestamp BEFORE activities (which can timeout)
        if (settingsId) {
          await supabase
            .from('crm_settings')
            .update({ last_full_sync_at: new Date().toISOString() })
            .eq('id', settingsId);
        }

        const activitiesResult = await syncActivities(rdToken, supabase);
        
        result = {
          pipelines: pipelinesResult,
          contacts: contactsResult,
          deals: dealsResult,
          activities: activitiesResult
        };
        break;
      
      // Bidirectional sync actions - Update RD Station when local changes happen
      case 'update_deal':
        result = await updateDealInRdStation(rdToken, supabase, data);
        break;
      case 'update_deal_stage':
        result = await updateDealStageInRdStation(rdToken, supabase, data);
        break;
      case 'update_contact':
        result = await updateContactInRdStation(rdToken, supabase, data);
        break;
      case 'create_activity':
        result = await createActivityInRdStation(rdToken, supabase, data);
        break;
      case 'fetch_contact_activities':
        result = await fetchContactActivitiesFromRdStation(rdToken, supabase, data);
        break;
      case 'create_contact':
        result = await createContactInRdStation(rdToken, supabase, data);
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in CRM sync:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== Bidirectional Sync Functions ====================

async function updateDealInRdStation(rdToken: string, supabase: any, data: any) {
  const { deal_id, updates } = data;
  
  // Get the local deal with RD Station ID
  const { data: deal, error: dealError } = await supabase
    .from('crm_deals')
    .select('rd_station_id, name, value, notes')
    .eq('id', deal_id)
    .single();
  
  if (dealError || !deal?.rd_station_id) {
    throw new Error('Deal não encontrado ou não sincronizado com RD Station');
  }

  // Update in RD Station
  const rdUpdates: any = {};
  if (updates.name !== undefined) rdUpdates.name = updates.name;
  if (updates.value !== undefined) rdUpdates.amount_total = updates.value;
  if (updates.notes !== undefined) rdUpdates.notes = updates.notes;
  if (updates.expected_close_date !== undefined) rdUpdates.prediction_date = updates.expected_close_date;

  const response = await fetch(
    `${RD_STATION_API_URL}/deals/${deal.rd_station_id}?token=${rdToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdUpdates)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station update error:', errorText);
    throw new Error(`Erro ao atualizar deal no RD Station: ${response.status}`);
  }

  // Update locally
  await supabase
    .from('crm_deals')
    .update(updates)
    .eq('id', deal_id);

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'deal',
    entity_id: deal_id,
    status: 'success'
  });

  return { updated: true, rd_station_id: deal.rd_station_id };
}

async function updateDealStageInRdStation(rdToken: string, supabase: any, data: any) {
  const { deal_id, stage_id, user_id } = data;
  
  // Get the local deal and stage with RD Station IDs
  const { data: deal, error: dealError } = await supabase
    .from('crm_deals')
    .select('rd_station_id, stage_id')
    .eq('id', deal_id)
    .single();
  
  if (dealError || !deal?.rd_station_id) {
    throw new Error('Deal não encontrado ou não sincronizado com RD Station');
  }

  const { data: stage, error: stageError } = await supabase
    .from('crm_deal_stages')
    .select('rd_station_id, name, is_won, is_lost')
    .eq('id', stage_id)
    .single();

  if (stageError || !stage?.rd_station_id) {
    throw new Error('Etapa não encontrada ou não sincronizada com RD Station');
  }

  // Update stage in RD Station
  const response = await fetch(
    `${RD_STATION_API_URL}/deals/${deal.rd_station_id}?token=${rdToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_stage_id: stage.rd_station_id
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station stage update error:', errorText);
    throw new Error(`Erro ao atualizar etapa no RD Station: ${response.status}`);
  }

  const previousStageId = deal.stage_id;

  // Update locally
  const updateData: any = { stage_id };
  if (stage.is_won) {
    updateData.won = true;
    updateData.closed_at = new Date().toISOString();
  } else if (stage.is_lost) {
    updateData.won = false;
    updateData.closed_at = new Date().toISOString();
  }

  await supabase
    .from('crm_deals')
    .update(updateData)
    .eq('id', deal_id);

  // Record history
  await supabase.from('crm_deal_history').insert({
    deal_id,
    from_stage_id: previousStageId,
    to_stage_id: stage_id,
    changed_by: user_id
  });

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'deal_stage',
    entity_id: deal_id,
    status: 'success'
  });

  return { updated: true, stage_name: stage.name };
}

async function updateContactInRdStation(rdToken: string, supabase: any, data: any) {
  const { contact_id, updates } = data;
  
  // Get the local contact with RD Station ID
  const { data: contact, error: contactError } = await supabase
    .from('crm_contacts')
    .select('rd_station_id')
    .eq('id', contact_id)
    .single();
  
  if (contactError || !contact?.rd_station_id) {
    throw new Error('Contato não encontrado ou não sincronizado com RD Station');
  }

  // Map local fields to RD Station fields
  const rdUpdates: any = {};
  if (updates.name !== undefined) rdUpdates.name = updates.name;
  if (updates.email !== undefined) rdUpdates.emails = [{ email: updates.email }];
  if (updates.phone !== undefined) rdUpdates.phones = [{ phone: updates.phone }];
  if (updates.company !== undefined) rdUpdates.organization = { name: updates.company };
  if (updates.job_title !== undefined) rdUpdates.title = updates.job_title;
  if (updates.notes !== undefined) rdUpdates.notes = updates.notes;
  if (updates.linkedin !== undefined) rdUpdates.linkedin = updates.linkedin;
  if (updates.facebook !== undefined) rdUpdates.facebook = updates.facebook;
  if (updates.twitter !== undefined) rdUpdates.twitter = updates.twitter;
  if (updates.website !== undefined) rdUpdates.website = updates.website;

  const response = await fetch(
    `${RD_STATION_API_URL}/contacts/${contact.rd_station_id}?token=${rdToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdUpdates)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station contact update error:', errorText);
    throw new Error(`Erro ao atualizar contato no RD Station: ${response.status}`);
  }

  // Update locally
  await supabase
    .from('crm_contacts')
    .update(updates)
    .eq('id', contact_id);

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'contact',
    entity_id: contact_id,
    status: 'success'
  });

  return { updated: true, rd_station_id: contact.rd_station_id };
}

async function createActivityInRdStation(rdToken: string, supabase: any, data: any) {
  const { deal_id, contact_id, activity } = data;
  
  // Get RD Station IDs
  let rdDealId = null;
  let rdContactId = null;

  if (deal_id) {
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('rd_station_id')
      .eq('id', deal_id)
      .single();
    rdDealId = deal?.rd_station_id;
  }

  if (contact_id) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('rd_station_id')
      .eq('id', contact_id)
      .single();
    rdContactId = contact?.rd_station_id;
  }

  // Create activity/task in RD Station
  const rdActivity: any = {
    subject: activity.title,
    type: mapActivityType(activity.type),
    date: activity.due_date || new Date().toISOString()
  };

  if (rdDealId) rdActivity.deal_id = rdDealId;
  if (rdContactId) rdActivity.contact_id = rdContactId;
  if (activity.description) rdActivity.text = activity.description;

  const response = await fetch(
    `${RD_STATION_API_URL}/activities?token=${rdToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdActivity)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station activity create error:', errorText);
    throw new Error(`Erro ao criar atividade no RD Station: ${response.status}`);
  }

  const rdActivityResponse = await response.json();

  // Create locally
  const { data: localActivity, error: activityError } = await supabase
    .from('crm_activities')
    .insert({
      ...activity,
      deal_id,
      contact_id,
      rd_station_id: rdActivityResponse._id
    })
    .select()
    .single();

  if (activityError) {
    console.error('Error creating local activity:', activityError);
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'activity',
    entity_id: localActivity?.id,
    status: 'success'
  });

  return { created: true, activity_id: localActivity?.id, rd_station_id: rdActivityResponse._id };
}

function mapActivityType(type: string): number {
  // RD Station activity types: 0 = note, 1 = call, 2 = email, 3 = meeting, 4 = task
  const typeMap: { [key: string]: number } = {
    'note': 0,
    'call': 1,
    'email': 2,
    'meeting': 3,
    'task': 4
  };
  return typeMap[type] || 4;
}

// ==================== Import Functions ====================

async function syncPipelines(rdToken: string, supabase: any) {
  console.log('Syncing pipelines from RD Station...');
  
  // Fetch deal stages (which include pipeline info)
  const response = await fetch(`${RD_STATION_API_URL}/deal_stages?token=${rdToken}&limit=200`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station API error:', errorText);
    throw new Error(`Erro ao buscar pipelines: ${response.status}`);
  }

  const data = await response.json();
  const stages = data.deal_stages || [];
  
  console.log(`Found ${stages.length} deal stages`);

  // Group stages by pipeline
  const pipelinesMap = new Map();
  
  for (const stage of stages) {
    const pipelineId = stage.deal_pipeline?._id || 'default';
    const pipelineName = stage.deal_pipeline?.name || 'Pipeline Padrão';
    
    if (!pipelinesMap.has(pipelineId)) {
      pipelinesMap.set(pipelineId, {
        rd_station_id: pipelineId,
        name: pipelineName,
        stages: []
      });
    }
    
    pipelinesMap.get(pipelineId).stages.push({
      rd_station_id: stage._id,
      name: stage.name,
      order_index: stage.order || 0,
      is_won: stage.name?.toLowerCase().includes('ganho') || stage.name?.toLowerCase().includes('won') || stage.name?.toLowerCase().includes('fechamento'),
      is_lost: stage.name?.toLowerCase().includes('perdido') || stage.name?.toLowerCase().includes('lost')
    });
  }

  let pipelinesCreated = 0;
  let stagesCreated = 0;

  // Insert/update pipelines and stages
  for (const [pipelineRdId, pipelineData] of pipelinesMap) {
    // Upsert pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from('crm_pipelines')
      .upsert({
        rd_station_id: pipelineRdId,
        name: pipelineData.name,
        is_default: pipelinesMap.size === 1
      }, { onConflict: 'rd_station_id' })
      .select()
      .single();

    if (pipelineError) {
      console.error('Error upserting pipeline:', pipelineError);
      continue;
    }
    pipelinesCreated++;

    // Upsert stages for this pipeline
    for (const stage of pipelineData.stages) {
      const { error: stageError } = await supabase
        .from('crm_deal_stages')
        .upsert({
          rd_station_id: stage.rd_station_id,
          pipeline_id: pipeline.id,
          name: stage.name,
          order_index: stage.order_index,
          is_won: stage.is_won,
          is_lost: stage.is_lost
        }, { onConflict: 'rd_station_id' });

      if (stageError) {
        console.error('Error upserting stage:', stageError);
      } else {
        stagesCreated++;
      }
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'pipeline',
    status: 'success'
  });

  return { pipelines: pipelinesCreated, stages: stagesCreated };
}

async function syncContacts(rdToken: string, supabase: any) {
  console.log('Syncing contacts from RD Station...');
  
  let allContacts: any[] = [];
  let page = 1;
  const limit = 200;
  
  // Paginate through ALL contacts without limit
  while (true) {
    const response = await fetch(
      `${RD_STATION_API_URL}/contacts?token=${rdToken}&page=${page}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar contatos: ${response.status}`);
    }

    const data = await response.json();
    const contacts = data.contacts || [];
    
    if (contacts.length === 0) break;
    
    allContacts = [...allContacts, ...contacts];
    console.log(`Fetched page ${page}, total contacts: ${allContacts.length}`);
    
    if (contacts.length < limit) break;
    page++;
    
    // Safety limit to prevent infinite loops
    if (page > 100) break;
  }

  console.log(`Total contacts to sync: ${allContacts.length}`);

  // Transform contacts data - including ALL UTM and tracking fields + original created_at
  const contactsData = allContacts.map(contact => {
    // Log FULL contact data for debugging (first 3 contacts only)
    if (allContacts.indexOf(contact) < 3) {
      console.log('=== FULL RAW CONTACT DATA ===');
      console.log('Contact keys:', Object.keys(contact));
      console.log('Full contact:', JSON.stringify(contact, null, 2));
    }

    // Extract UTM and tracking data from multiple possible locations
    // RD Station can store this data in different places depending on how the lead was created
    const customFields = contact.custom_fields || {};
    
    // Traffic source (Fonte) - e.g., "Busca Paga | Facebook"
    const trafficSource = contact.traffic_source || 
                         contact.lead_source || 
                         contact.source ||
                         customFields.traffic_source ||
                         customFields.fonte ||
                         null;
    
    // Traffic medium
    const trafficMedium = contact.traffic_medium ||
                         customFields.traffic_medium ||
                         null;
    
    // Campaign name (Campanha) - e.g., "Leads Férias Prêmio"
    const trafficCampaign = contact.traffic_campaign ||
                           contact.campaign?.name ||
                           customFields.traffic_campaign ||
                           customFields.campanha ||
                           null;

    // UTM parameters - check multiple locations
    const utmSource = contact.utm_source || 
                     customFields.utm_source || 
                     customFields.cf_utm_source ||
                     customFields['UTM Source'] ||
                     customFields['utm source'] ||
                     (trafficSource?.toLowerCase()?.includes('facebook') ? 'facebook' : null) ||
                     null;
    
    const utmMedium = contact.utm_medium || 
                     customFields.utm_medium || 
                     customFields.cf_utm_medium ||
                     customFields['UTM Medium'] ||
                     customFields['utm medium'] ||
                     trafficMedium ||
                     null;
    
    const utmCampaign = contact.utm_campaign || 
                       customFields.utm_campaign || 
                       customFields.cf_utm_campaign ||
                       customFields['UTM Campaign'] ||
                       customFields['utm campaign'] ||
                       null;
    
    const utmContent = contact.utm_content || 
                      customFields.utm_content || 
                      customFields.cf_utm_content ||
                      customFields['UTM Content'] ||
                      customFields['utm content'] ||
                      null;
    
    const utmTerm = contact.utm_term || 
                   customFields.utm_term || 
                   customFields.cf_utm_term ||
                   customFields['UTM Term'] ||
                   customFields['utm term'] ||
                   null;

    return {
      rd_station_id: contact._id,
      name: contact.name || contact.emails?.[0]?.email || 'Sem nome',
      email: contact.emails?.[0]?.email || null,
      phone: contact.phones?.[0]?.phone || null,
      company: contact.organization?.name || null,
      job_title: contact.title || null,
      address: contact.address?.street || null,
      city: contact.address?.city || null,
      state: contact.address?.state || null,
      country: contact.address?.country || null,
      website: contact.website || null,
      linkedin: contact.linkedin || null,
      facebook: contact.facebook || null,
      twitter: contact.twitter || null,
      birthday: contact.birthday || null,
      notes: contact.notes || null,
      custom_fields: {
        ...customFields,
        // Also store the raw traffic fields for reference
        _traffic_source: trafficSource,
        _traffic_medium: trafficMedium,
        _traffic_campaign: trafficCampaign
      },
      lead_score: contact.score || 0,
      // Traffic source fields (Fonte, Campanha from RD Station)
      traffic_source: trafficSource,
      traffic_medium: trafficMedium,
      traffic_campaign: trafficCampaign,
      // UTM tracking fields
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      // Conversion tracking
      first_conversion: contact.first_conversion?.content || contact.first_conversion?.identifier || contact.first_conversion_date || null,
      last_conversion: contact.last_conversion?.content || contact.last_conversion?.identifier || contact.last_conversion_date || null,
      // Use original created_at from RD Station if available
      created_at: contact.created_at || new Date().toISOString()
    };
  });

  // Batch upsert in chunks of 500 for faster processing
  const BATCH_SIZE = 500;
  let contactsCreated = 0;

  for (let i = 0; i < contactsData.length; i += BATCH_SIZE) {
    const batch = contactsData.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('crm_contacts')
      .upsert(batch, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting contacts batch:', error);
    } else {
      contactsCreated += batch.length;
      console.log(`Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${contactsCreated}`);
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'contact',
    status: 'success'
  });

  return { contacts: contactsCreated };
}

async function syncDeals(rdToken: string, supabase: any) {
  console.log('Syncing deals from RD Station...');
  
  let allDeals: any[] = [];
  let page = 1;
  const limit = 200;
  
  // Paginate through ALL deals without limit
  while (true) {
    const response = await fetch(
      `${RD_STATION_API_URL}/deals?token=${rdToken}&page=${page}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar deals: ${response.status}`);
    }

    const data = await response.json();
    const deals = data.deals || [];
    
    if (deals.length === 0) break;
    
    allDeals = [...allDeals, ...deals];
    console.log(`Fetched page ${page}, total deals: ${allDeals.length}`);
    
    if (deals.length < limit) break;
    page++;
    
    // Safety limit to prevent infinite loops
    if (page > 100) break;
  }

  console.log(`Total deals to sync: ${allDeals.length}`);

  // Get stage mappings (including is_won flag)
  const { data: stages } = await supabase
    .from('crm_deal_stages')
    .select('id, rd_station_id, pipeline_id, is_won');
  
  const stageMap = new Map<string, { id: string; pipeline_id: string; rd_station_id: string }>(
    stages?.map((s: any) => [s.rd_station_id, s]) || []
  );

  // Build set of won stage IDs for quick lookup
  const wonStageIds = new Set<string>(
    stages?.filter((s: any) => s.is_won).map((s: any) => s.id) || []
  );

  // Get contact mappings - fetch all without limit
  let allContacts: any[] = [];
  let contactPage = 0;
  const contactLimit = 1000;
  
  while (true) {
    const { data: contactsBatch } = await supabase
      .from('crm_contacts')
      .select('id, rd_station_id, name, email')
      .range(contactPage * contactLimit, (contactPage + 1) * contactLimit - 1);
    
    if (!contactsBatch || contactsBatch.length === 0) break;
    allContacts = [...allContacts, ...contactsBatch];
    if (contactsBatch.length < contactLimit) break;
    contactPage++;
  }
  
  // Create multiple maps for contact lookup
  const contactMapById = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));
  const contactMapByName = new Map(allContacts.map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));
  const contactMapByEmail = new Map(allContacts.filter((c: any) => c.email).map((c: any) => [c.email?.toLowerCase()?.trim(), c.id]));

  // Get user/owner mappings from profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');
  
  // Create email to profile ID map for owner matching
  const emailToProfileMap = new Map<string, string>(
    profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []
  );

  // Transform deals data - including owner_id and contact_id with multiple lookup strategies
  let debugCount = 0;
  const dealsData = allDeals.map(deal => {
    const stageInfo = stageMap.get(deal.deal_stage?._id);
    const stageIsWon = stageInfo && wonStageIds.has(stageInfo.id);

    // Debug: log date fields for first 5 deals in won stages
    if (stageIsWon && debugCount < 5) {
      console.log(`[DEBUG WON DEAL] name="${deal.name}", closed_at=${deal.closed_at}, last_activity_at=${deal.last_activity_at}, created_at=${deal.created_at}, updated_at=${deal.updated_at}, win=${deal.win}, win_date=${deal.win_date}`);
      debugCount++;
    }
    
    // Try multiple strategies to find contact_id
    let contactId = null;
    
    // 1. Try by contact._id from deal
    if (deal.contacts?.[0]?._id) {
      contactId = contactMapById.get(deal.contacts[0]._id);
    }
    
    // 2. Try by deal name (deals often have same name as contact)
    if (!contactId && deal.name) {
      contactId = contactMapByName.get(deal.name?.toLowerCase()?.trim());
    }
    
    // 3. Try by contact email
    if (!contactId && deal.contacts?.[0]?.emails?.[0]?.email) {
      contactId = contactMapByEmail.get(deal.contacts[0].emails[0].email?.toLowerCase()?.trim());
    }
    
    // Try to match owner by email
    let ownerId = null;
    if (deal.user?.email) {
      ownerId = emailToProfileMap.get(deal.user.email.toLowerCase()) || null;
    }

    // Check if deal is in a won stage (stageIsWon already computed above for debug)
    const dealIsWon = deal.win === true || deal.win === 'won' || deal.win === 1 || stageIsWon;

    return {
      rd_station_id: deal._id,
      contact_id: contactId || null,
      pipeline_id: stageInfo?.pipeline_id || null,
      stage_id: stageInfo?.id || null,
      owner_id: ownerId,
      name: deal.name || 'Deal sem nome',
      value: deal.amount_total || 0,
      expected_close_date: deal.prediction_date || null,
      closed_at: deal.closed_at || (dealIsWon ? (deal.last_activity_at || null) : null),
      won: dealIsWon,
      loss_reason: deal.loss_reason || null,
      product_name: deal.deal_products?.[0]?.name || null,
      campaign_name: deal.campaign?.name || null,
      notes: deal.notes || null,
      custom_fields: deal.custom_fields || {},
      // Use original created_at from RD Station
      created_at: deal.created_at || new Date().toISOString()
    };
  });

  // Fetch existing deals to detect stage changes
  const existingDealsMap = new Map<string, { id: string; stage_id: string | null }>();
  let existingPage = 0;
  const existingLimit = 1000;
  while (true) {
    const { data: existingBatch } = await supabase
      .from('crm_deals')
      .select('id, rd_station_id, stage_id')
      .range(existingPage * existingLimit, (existingPage + 1) * existingLimit - 1);
    if (!existingBatch || existingBatch.length === 0) break;
    for (const d of existingBatch) {
      if (d.rd_station_id) existingDealsMap.set(d.rd_station_id, { id: d.id, stage_id: d.stage_id });
    }
    if (existingBatch.length < existingLimit) break;
    existingPage++;
  }

  // Batch upsert in chunks of 500 for faster processing
  const BATCH_SIZE = 500;
  let dealsCreated = 0;

  for (let i = 0; i < dealsData.length; i += BATCH_SIZE) {
    const batch = dealsData.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('crm_deals')
      .upsert(batch, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting deals batch:', error);
    } else {
      dealsCreated += batch.length;
      console.log(`Upserted deals batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${dealsCreated}`);
    }
  }

  // Detect stage changes and record history + update stage_changed_at
  const historyInserts: any[] = [];
  const stageChangedUpdates: { id: string; stage_id: string }[] = [];

  for (const deal of dealsData) {
    const existing = existingDealsMap.get(deal.rd_station_id);
    if (existing && deal.stage_id && existing.stage_id !== deal.stage_id) {
      // Stage changed — record history
      historyInserts.push({
        deal_id: existing.id,
        from_stage_id: existing.stage_id,
        to_stage_id: deal.stage_id,
      });
      stageChangedUpdates.push({ id: existing.id, stage_id: deal.stage_id });
    }
  }

  // Insert history records
  if (historyInserts.length > 0) {
    const { error: histErr } = await supabase.from('crm_deal_history').insert(historyInserts);
    if (histErr) console.error('Error inserting deal history:', histErr);
    else console.log(`Recorded ${historyInserts.length} stage transitions in crm_deal_history`);
  }

  // Update stage_changed_at for deals that changed stage (and closed_at + won for won stages)
  for (const upd of stageChangedUpdates) {
    const updateData: any = { stage_changed_at: new Date().toISOString() };
    if (wonStageIds.has(upd.stage_id)) {
      updateData.closed_at = new Date().toISOString();
      updateData.won = true;
    }
    await supabase.from('crm_deals')
      .update(updateData)
      .eq('id', upd.id);
  }

  // Fix deals in won stages that are missing won=true or closed_at
  if (wonStageIds.size > 0) {
    const wonStageIdsArr = Array.from(wonStageIds);
    const { data: missingWonDeals } = await supabase
      .from('crm_deals')
      .select('id, stage_changed_at, updated_at, created_at')
      .in('stage_id', wonStageIdsArr)
      .eq('won', false);

    if (missingWonDeals && missingWonDeals.length > 0) {
      console.log(`Fixing ${missingWonDeals.length} deals in won stages missing won=true`);
      for (const d of missingWonDeals) {
        await supabase.from('crm_deals').update({
          won: true,
          closed_at: d.stage_changed_at || d.updated_at || new Date().toISOString()
        }).eq('id', d.id);
      }
    }

    // Also fix deals that are won=true but missing closed_at
    const { data: missingClosedAt } = await supabase
      .from('crm_deals')
      .select('id, stage_changed_at, updated_at, created_at')
      .in('stage_id', wonStageIdsArr)
      .eq('won', true)
      .is('closed_at', null);

    if (missingClosedAt && missingClosedAt.length > 0) {
      console.log(`Fixing ${missingClosedAt.length} won deals missing closed_at`);
      for (const d of missingClosedAt) {
        await supabase.from('crm_deals').update({
          closed_at: d.stage_changed_at || d.updated_at || new Date().toISOString()
        }).eq('id', d.id);
      }
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'deal',
    status: 'success'
  });

  return { deals: dealsCreated, stage_transitions: historyInserts.length };
}

// Sync tasks from RD Station (using /tasks endpoint instead of /activities)
async function syncActivities(rdToken: string, supabase: any) {
  console.log('Syncing tasks from RD Station...');
  
  // Get deals for mapping
  const MAX_DEALS_FOR_ACTIVITIES = 200;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString();
  
  const { data: recentDeals } = await supabase
    .from('crm_deals')
    .select('id, rd_station_id, name, contact_id')
    .or(`created_at.gte.${cutoffDate},closed_at.gte.${cutoffDate}`)
    .order('created_at', { ascending: false })
    .limit(MAX_DEALS_FOR_ACTIVITIES);
  
  const allDeals = recentDeals || [];
  console.log(`Found ${allDeals.length} recent deals for task mapping`);

  const dealMapByRdId = new Map(allDeals.map((d: any) => [d.rd_station_id, { id: d.id, contact_id: d.contact_id, name: d.name }]));
  
  // Get contacts
  let allContacts: any[] = [];
  let contactPage = 0;
  while (true) {
    const { data: contactsBatch } = await supabase
      .from('crm_contacts')
      .select('id, rd_station_id, name, email')
      .range(contactPage * 1000, (contactPage + 1) * 1000 - 1);
    if (!contactsBatch || contactsBatch.length === 0) break;
    allContacts = [...allContacts, ...contactsBatch];
    if (contactsBatch.length < 1000) break;
    contactPage++;
  }
  const contactMapByRdId = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));
  const contactMapByName = new Map(allContacts.map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));

  // Get user mappings
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');
  const emailToProfileMap = new Map(
    profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []
  );

  let allTasks: any[] = [];
  
  // Fetch tasks using the /tasks endpoint (two passes: pending + completed)
  for (const doneFilter of [false, true]) {
    let page = 1;
    const limit = 200;
    
    while (page <= 30) {
      try {
        const url = `${RD_STATION_API_URL}/tasks?token=${rdToken}&page=${page}&limit=${limit}&done=${doneFilter}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`Tasks API returned ${response.status} for done=${doneFilter}, page=${page}`);
          break;
        }

        const data = await response.json();
        const items = data.tasks || [];
        
        if (items.length === 0) break;
        
        allTasks = [...allTasks, ...items];
        console.log(`Fetched tasks page ${page} (done=${doneFilter}), got ${items.length}, total: ${allTasks.length}`);
        
        // Check if there are more pages
        if (data.has_more === false || items.length < limit) break;
        page++;
      } catch (error) {
        console.error(`Error fetching tasks page ${page} (done=${doneFilter}):`, error);
        break;
      }
    }
  }

  console.log(`Total tasks to sync: ${allTasks.length}`);

  if (allTasks.length === 0) {
    return { activities: 0 };
  }

  // Transform and dedupe tasks
  const seenIds = new Set<string>();
  const activitiesData = allTasks
    .filter(task => {
      if (!task._id || seenIds.has(task._id)) return false;
      seenIds.add(task._id);
      return true;
    })
    .map(task => {
      // Map deal
      let dealId = null;
      let contactId = null;
      
      if (task.deal?._id) {
        const dealInfo = dealMapByRdId.get(task.deal._id);
        if (dealInfo) {
          dealId = dealInfo.id;
          contactId = dealInfo.contact_id;
        }
      }
      
      // Try contact directly
      if (!contactId && task.contact?._id) {
        contactId = contactMapByRdId.get(task.contact._id);
      }
      if (!contactId && task.contact?.name) {
        contactId = contactMapByName.get(task.contact.name?.toLowerCase()?.trim());
      }
      
      // Map owner from users array
      let ownerId = null;
      if (task.users && task.users.length > 0 && task.users[0].email) {
        ownerId = emailToProfileMap.get(task.users[0].email.toLowerCase()) || null;
      } else if (task.user?.email) {
        ownerId = emailToProfileMap.get(task.user.email.toLowerCase()) || null;
      }

      // Map task type directly from RD Station task types
      let type = 'task';
      const taskType = (task.type || '').toLowerCase();
      if (taskType === 'call' || taskType === 'ligação') type = 'call';
      else if (taskType === 'email' || taskType === 'e-mail') type = 'email';
      else if (taskType === 'meeting' || taskType === 'reunião') type = 'meeting';
      else if (taskType === 'visit' || taskType === 'visita') type = 'visit';
      else if (taskType === 'lunch' || taskType === 'almoço') type = 'lunch';
      else if (taskType === 'whatsapp') type = 'whatsapp';
      else if (taskType === 'task' || taskType === 'tarefa') type = 'task';

      return {
        rd_station_id: task._id,
        deal_id: dealId,
        contact_id: contactId,
        owner_id: ownerId,
        type: type,
        title: task.subject || task.name || 'Tarefa sem título',
        description: task.notes || task.description || null,
        due_date: task.date || task.due_date || null,
        completed: task.done === true,
        completed_at: task.done_date || null,
        status: task.done === true ? 'completed' : 'pending',
        created_at: task.created_at || new Date().toISOString()
      };
    });

  console.log(`Filtered unique tasks: ${activitiesData.length}`);
  
  const withDeal = activitiesData.filter(a => a.deal_id).length;
  const withContact = activitiesData.filter(a => a.contact_id).length;
  const completedCount = activitiesData.filter(a => a.completed).length;
  console.log(`Tasks with deal_id: ${withDeal}, with contact_id: ${withContact}, completed: ${completedCount}`);

  // Batch upsert
  const BATCH_SIZE = 500;
  let activitiesCreated = 0;

  for (let i = 0; i < activitiesData.length; i += BATCH_SIZE) {
    const batch = activitiesData.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('crm_activities')
      .upsert(batch, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting tasks batch:', error);
    } else {
      activitiesCreated += batch.length;
      console.log(`Upserted tasks batch, total: ${activitiesCreated}`);
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'activity',
    status: 'success'
  });

  return { activities: activitiesCreated, with_deal: withDeal, with_contact: withContact, completed: completedCount };
}

// Fetch tasks from RD Station for a specific contact/deal in real-time
async function fetchContactActivitiesFromRdStation(rdToken: string, supabase: any, data: any) {
  console.log('Fetching tasks for contact from RD Station...', data);
  
  const { contact_id, rd_station_id, deal_rd_station_ids } = data;
  
  if (!contact_id && !rd_station_id && (!deal_rd_station_ids || deal_rd_station_ids.length === 0)) {
    return { activities: [] };
  }
  
  // Get profiles for owner mapping
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name');
  const emailToProfileMap = new Map<string, { id: string; full_name: string }>(
    profiles?.map((p: any) => [p.email?.toLowerCase(), { id: p.id, full_name: p.full_name }]) || []
  );
  
  let allTasks: any[] = [];
  
  // Fetch tasks for each deal using /tasks?deal_id=
  if (deal_rd_station_ids && deal_rd_station_ids.length > 0) {
    for (const dealRdId of deal_rd_station_ids) {
      if (!dealRdId) continue;
      
      try {
        const response = await fetch(
          `${RD_STATION_API_URL}/tasks?token=${rdToken}&deal_id=${dealRdId}&limit=200`
        );
        
        if (response.ok) {
          const data = await response.json();
          const dealTasks = data.tasks || [];
          console.log(`Fetched ${dealTasks.length} tasks from deal ${dealRdId}`);
          allTasks = [...allTasks, ...dealTasks];
        }
      } catch (error) {
        console.error(`Error fetching tasks from deal ${dealRdId}:`, error);
      }
    }
  }
  
  // Deduplicate by _id
  const seenIds = new Set<string>();
  const uniqueTasks = allTasks.filter(t => {
    if (!t._id || seenIds.has(t._id)) return false;
    seenIds.add(t._id);
    return true;
  });
  
  console.log(`Total unique tasks found: ${uniqueTasks.length}`);
  
  // Transform tasks
  const transformedActivities = uniqueTasks.map(task => {
    let type = 'task';
    const taskType = (task.type || '').toLowerCase();
    if (taskType === 'call' || taskType === 'ligação') type = 'call';
    else if (taskType === 'email' || taskType === 'e-mail') type = 'email';
    else if (taskType === 'meeting' || taskType === 'reunião') type = 'meeting';
    else if (taskType === 'whatsapp') type = 'whatsapp';
    
    let ownerName = null;
    if (task.users && task.users.length > 0) {
      const userEmail = task.users[0].email?.toLowerCase();
      if (userEmail) {
        const profile = emailToProfileMap.get(userEmail);
        ownerName = profile?.full_name || task.users[0].name || userEmail;
      }
    } else if (task.user?.email) {
      const profile = emailToProfileMap.get(task.user.email.toLowerCase());
      ownerName = profile?.full_name || task.user.name || task.user.email;
    }
    
    return {
      id: task._id,
      rd_station_id: task._id,
      type: type,
      title: task.subject || task.name || 'Tarefa sem título',
      description: task.notes || task.description || null,
      due_date: task.date || task.due_date || null,
      completed: task.done === true,
      completed_at: task.done_date || null,
      created_at: task.created_at || new Date().toISOString(),
      owner_name: ownerName,
      deal_name: task.deal?.name || null
    };
  });
  
  // Sort by created_at descending
  transformedActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Save to database
  if (transformedActivities.length > 0 && contact_id) {
    for (const activity of transformedActivities) {
      let ownerId = null;
      if (activity.owner_name) {
        for (const [email, profile] of emailToProfileMap.entries()) {
          if (profile.full_name === activity.owner_name) {
            ownerId = profile.id;
            break;
          }
        }
      }
      
      await supabase
        .from('crm_activities')
        .upsert({
          rd_station_id: activity.rd_station_id,
          contact_id: contact_id,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          due_date: activity.due_date,
          completed: activity.completed,
          completed_at: activity.completed_at,
          created_at: activity.created_at,
          owner_id: ownerId
        }, { onConflict: 'rd_station_id' });
    }
    console.log(`Saved ${transformedActivities.length} tasks to database for contact ${contact_id}`);
}

async function createContactInRdStation(rdToken: string, supabase: any, data: any) {
  const { name, email, phone, company, job_title, city, state, website, linkedin, notes } = data;

  if (!name || name.trim() === '') {
    throw new Error('Nome é obrigatório');
  }

  // Build RD Station contact payload
  const rdPayload: any = { name: name.trim() };
  
  if (email) rdPayload.emails = [{ email: email.trim() }];
  if (phone) rdPayload.phones = [{ phone: phone.trim() }];
  if (company) rdPayload.organization = company.trim();
  if (job_title) rdPayload.title = job_title.trim();
  if (website) rdPayload.website = website.trim();
  if (linkedin) rdPayload.linkedin = linkedin.trim();
  if (notes) rdPayload.notes = notes.trim();

  console.log('[create_contact] Creating contact in RD Station:', rdPayload.name);

  // Create in RD Station
  const rdResponse = await fetch(`${RD_STATION_API_URL}/contacts?token=${rdToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rdPayload)
  });

  let rdContact: any = null;
  let rdStationId: string | null = null;

  if (rdResponse.ok) {
    rdContact = await rdResponse.json();
    rdStationId = rdContact._id || rdContact.id;
    console.log('[create_contact] Created in RD Station with ID:', rdStationId);
  } else {
    const errorText = await rdResponse.text();
    console.error('[create_contact] RD Station error:', rdResponse.status, errorText);
    // Continue to save locally even if RD Station fails
  }

  // Upsert in local database
  const contactData: any = {
    name: name.trim(),
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    company: company?.trim() || null,
    job_title: job_title?.trim() || null,
    city: city?.trim() || null,
    state: state?.trim() || null,
    website: website?.trim() || null,
    linkedin: linkedin?.trim() || null,
    notes: notes?.trim() || null,
    updated_at: new Date().toISOString()
  };

  if (rdStationId) {
    contactData.rd_station_id = rdStationId;
  }

  const { data: insertedContact, error: dbError } = await supabase
    .from('crm_contacts')
    .insert(contactData)
    .select()
    .single();

  if (dbError) {
    console.error('[create_contact] DB error:', dbError);
    throw new Error('Erro ao salvar contato no banco: ' + dbError.message);
  }

  console.log('[create_contact] Contact saved locally:', insertedContact.id);

  return { 
    contact: insertedContact, 
    synced_to_rd: !!rdStationId,
    rd_station_id: rdStationId
  };
}
  
  return { activities: transformedActivities };
}

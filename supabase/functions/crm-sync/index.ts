import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const RD_API = 'https://crm.rdstation.com/api/v1';

function mapTaskType(t: string): string {
  const m: Record<string, string> = { call:'call', 'ligação':'call', email:'email', 'e-mail':'email', meeting:'meeting', 'reunião':'meeting', visit:'visit', visita:'visit', lunch:'lunch', 'almoço':'lunch', whatsapp:'whatsapp', task:'task', tarefa:'task' };
  return m[(t||'').toLowerCase()] || 'task';
}

async function fetchAllPages(url: string, key: string, maxPages = 100): Promise<any[]> {
  let all: any[] = [], page = 1;
  while (page <= maxPages) {
    const sep = url.includes('?') ? '&' : '?';
    const r = await fetch(`${url}${sep}page=${page}&limit=200`);
    if (!r.ok) throw new Error(`API error ${r.status}`);
    const d = await r.json();
    const items = d[key] || [];
    if (!items.length) break;
    all = all.concat(items);
    if (items.length < 200) break;
    page++;
  }
  return all;
}

async function fetchAllFromTable(supabase: any, table: string, select: string): Promise<any[]> {
  let all: any[] = [], p = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(p * 1000, (p + 1) * 1000 - 1);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    p++;
  }
  return all;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!rdToken) return new Response(JSON.stringify({ error: 'RD_STATION_API_TOKEN não configurado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { action, data } = await req.json();
    let result: any;

    switch (action) {
      case 'sync_pipelines': result = await syncPipelines(rdToken, supabase); break;
      case 'sync_contacts': result = await syncContacts(rdToken, supabase); break;
      case 'sync_deals': result = await syncDeals(rdToken, supabase); break;
      case 'sync_activities': result = await syncActivities(rdToken, supabase); break;
      case 'full_sync': {
        const { data: sr } = await supabase.from('crm_settings').select('id').single();
        const p = await syncPipelines(rdToken, supabase);
        const c = await syncContacts(rdToken, supabase);
        const d = await syncDeals(rdToken, supabase);
        if (sr?.id) await supabase.from('crm_settings').update({ last_full_sync_at: new Date().toISOString() }).eq('id', sr.id);
        const a = await syncActivities(rdToken, supabase);
        result = { pipelines: p, contacts: c, deals: d, activities: a };
        break;
      }
      case 'update_deal': result = await updateDeal(rdToken, supabase, data); break;
      case 'update_deal_stage': result = await updateDealStage(rdToken, supabase, data); break;
      case 'update_contact': result = await updateContact(rdToken, supabase, data); break;
      case 'create_activity': result = await createActivity(rdToken, supabase, data); break;
      case 'fetch_contact_activities': result = await fetchContactActivities(rdToken, supabase, data); break;
      case 'create_contact': result = await createContact(rdToken, supabase, data); break;
      default: return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('CRM sync error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// === Bidirectional sync ===

async function updateDeal(rdToken: string, sb: any, data: any) {
  const { deal_id, updates } = data;
  const { data: deal } = await sb.from('crm_deals').select('rd_station_id').eq('id', deal_id).single();
  if (!deal?.rd_station_id) throw new Error('Deal não encontrado ou não sincronizado');
  const rd: any = {};
  if (updates.name !== undefined) rd.name = updates.name;
  if (updates.value !== undefined) rd.amount_total = updates.value;
  if (updates.notes !== undefined) rd.notes = updates.notes;
  if (updates.expected_close_date !== undefined) rd.prediction_date = updates.expected_close_date;
  const r = await fetch(`${RD_API}/deals/${deal.rd_station_id}?token=${rdToken}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rd) });
  if (!r.ok) { await r.text(); throw new Error(`Erro ao atualizar deal: ${r.status}`); }
  await sb.from('crm_deals').update(updates).eq('id', deal_id);
  await sb.from('crm_sync_log').insert({ sync_type: 'bidirectional', entity_type: 'deal', entity_id: deal_id, status: 'success' });
  return { updated: true, rd_station_id: deal.rd_station_id };
}

async function updateDealStage(rdToken: string, sb: any, data: any) {
  const { deal_id, stage_id, user_id } = data;
  const { data: deal } = await sb.from('crm_deals').select('rd_station_id, stage_id').eq('id', deal_id).single();
  if (!deal?.rd_station_id) throw new Error('Deal não encontrado');
  const { data: stage } = await sb.from('crm_deal_stages').select('rd_station_id, name, is_won, is_lost').eq('id', stage_id).single();
  if (!stage?.rd_station_id) throw new Error('Etapa não encontrada');
  const r = await fetch(`${RD_API}/deals/${deal.rd_station_id}?token=${rdToken}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_stage_id: stage.rd_station_id }) });
  if (!r.ok) { await r.text(); throw new Error(`Erro ao atualizar etapa: ${r.status}`); }
  const upd: any = { stage_id, stage_changed_at: new Date().toISOString() };
  if (stage.is_won) { upd.won = true; upd.closed_at = new Date().toISOString(); }
  else if (stage.is_lost) { upd.won = false; upd.closed_at = new Date().toISOString(); }
  else { upd.won = null; upd.closed_at = null; }
  await sb.from('crm_deals').update(upd).eq('id', deal_id);
  await sb.from('crm_deal_history').insert({ deal_id, from_stage_id: deal.stage_id, to_stage_id: stage_id, changed_by: user_id });
  await sb.from('crm_sync_log').insert({ sync_type: 'bidirectional', entity_type: 'deal_stage', entity_id: deal_id, status: 'success' });
  return { updated: true, stage_name: stage.name };
}

async function updateContact(rdToken: string, sb: any, data: any) {
  const { contact_id, updates } = data;
  const { data: contact } = await sb.from('crm_contacts').select('rd_station_id').eq('id', contact_id).single();
  if (!contact?.rd_station_id) throw new Error('Contato não encontrado');
  const rd: any = {};
  if (updates.name !== undefined) rd.name = updates.name;
  if (updates.email !== undefined) rd.emails = [{ email: updates.email }];
  if (updates.phone !== undefined) rd.phones = [{ phone: updates.phone }];
  if (updates.company !== undefined) rd.organization = { name: updates.company };
  if (updates.job_title !== undefined) rd.title = updates.job_title;
  if (updates.notes !== undefined) rd.notes = updates.notes;
  if (updates.linkedin !== undefined) rd.linkedin = updates.linkedin;
  if (updates.facebook !== undefined) rd.facebook = updates.facebook;
  if (updates.twitter !== undefined) rd.twitter = updates.twitter;
  if (updates.website !== undefined) rd.website = updates.website;
  const r = await fetch(`${RD_API}/contacts/${contact.rd_station_id}?token=${rdToken}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rd) });
  if (!r.ok) { await r.text(); throw new Error(`Erro ao atualizar contato: ${r.status}`); }
  await sb.from('crm_contacts').update(updates).eq('id', contact_id);
  await sb.from('crm_sync_log').insert({ sync_type: 'bidirectional', entity_type: 'contact', entity_id: contact_id, status: 'success' });
  return { updated: true, rd_station_id: contact.rd_station_id };
}

async function createActivity(rdToken: string, sb: any, data: any) {
  const { deal_id, contact_id, activity } = data;
  let rdDealId = null, rdContactId = null;
  if (deal_id) { const { data: d } = await sb.from('crm_deals').select('rd_station_id').eq('id', deal_id).single(); rdDealId = d?.rd_station_id; }
  if (contact_id) { const { data: c } = await sb.from('crm_contacts').select('rd_station_id').eq('id', contact_id).single(); rdContactId = c?.rd_station_id; }
  const rd: any = { subject: activity.title, type: ({ note:0, call:1, email:2, meeting:3, task:4 } as any)[activity.type] || 4, date: activity.due_date || new Date().toISOString() };
  if (rdDealId) rd.deal_id = rdDealId;
  if (rdContactId) rd.contact_id = rdContactId;
  if (activity.description) rd.text = activity.description;
  const r = await fetch(`${RD_API}/activities?token=${rdToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rd) });
  if (!r.ok) { await r.text(); throw new Error(`Erro ao criar atividade: ${r.status}`); }
  const rdRes = await r.json();
  const { data: local } = await sb.from('crm_activities').insert({ ...activity, deal_id, contact_id, rd_station_id: rdRes._id }).select().single();
  await sb.from('crm_sync_log').insert({ sync_type: 'bidirectional', entity_type: 'activity', entity_id: local?.id, status: 'success' });
  return { created: true, activity_id: local?.id, rd_station_id: rdRes._id };
}

// === Import/Sync functions ===

async function syncPipelines(rdToken: string, sb: any) {
  const r = await fetch(`${RD_API}/deal_stages?token=${rdToken}&limit=200`);
  if (!r.ok) throw new Error(`Erro ao buscar pipelines: ${r.status}`);
  const stages = (await r.json()).deal_stages || [];
  const pMap = new Map<string, any>();
  for (const s of stages) {
    const pid = s.deal_pipeline?._id || 'default';
    if (!pMap.has(pid)) pMap.set(pid, { rd_station_id: pid, name: s.deal_pipeline?.name || 'Pipeline Padrão', stages: [] });
    pMap.get(pid).stages.push({ rd_station_id: s._id, name: s.name, order_index: s.order || 0, is_won: s.name?.toLowerCase().includes('ganho') || s.name?.toLowerCase().includes('won') || s.name?.toLowerCase().includes('fechamento'), is_lost: s.name?.toLowerCase().includes('perdido') || s.name?.toLowerCase().includes('lost') });
  }
  let pc = 0, sc = 0;
  for (const [, pd] of pMap) {
    const { data: p, error } = await sb.from('crm_pipelines').upsert({ rd_station_id: pd.rd_station_id, name: pd.name, is_default: pMap.size === 1 }, { onConflict: 'rd_station_id' }).select().single();
    if (error) continue;
    pc++;
    for (const s of pd.stages) {
      const { error: se } = await sb.from('crm_deal_stages').upsert({ ...s, pipeline_id: p.id }, { onConflict: 'rd_station_id' });
      if (!se) sc++;
    }
  }
  await sb.from('crm_sync_log').insert({ sync_type: 'manual', entity_type: 'pipeline', status: 'success' });
  return { pipelines: pc, stages: sc };
}

async function syncContacts(rdToken: string, sb: any) {
  const all = await fetchAllPages(`${RD_API}/contacts?token=${rdToken}`, 'contacts');
  console.log(`Syncing ${all.length} contacts`);
  const contactsData = all.map(c => {
    const cf = c.custom_fields || {};
    const ts = c.traffic_source || c.lead_source || c.source || cf.traffic_source || cf.fonte || null;
    const tm = c.traffic_medium || cf.traffic_medium || null;
    const tc = c.traffic_campaign || c.campaign?.name || cf.traffic_campaign || cf.campanha || null;
    return {
      rd_station_id: c._id,
      name: c.name || c.emails?.[0]?.email || 'Sem nome',
      email: c.emails?.[0]?.email || null,
      phone: c.phones?.[0]?.phone || null,
      company: c.organization?.name || null,
      job_title: c.title || null,
      address: c.address?.street || null, city: c.address?.city || null, state: c.address?.state || null, country: c.address?.country || null,
      website: c.website || null, linkedin: c.linkedin || null, facebook: c.facebook || null, twitter: c.twitter || null,
      birthday: c.birthday || null, notes: c.notes || null,
      custom_fields: { ...cf, _traffic_source: ts, _traffic_medium: tm, _traffic_campaign: tc },
      lead_score: c.score || 0,
      traffic_source: ts, traffic_medium: tm, traffic_campaign: tc,
      utm_source: c.utm_source || cf.utm_source || cf.cf_utm_source || cf['UTM Source'] || (ts?.toLowerCase()?.includes('facebook') ? 'facebook' : null),
      utm_medium: c.utm_medium || cf.utm_medium || cf.cf_utm_medium || cf['UTM Medium'] || tm,
      utm_campaign: c.utm_campaign || cf.utm_campaign || cf.cf_utm_campaign || cf['UTM Campaign'] || null,
      utm_content: c.utm_content || cf.utm_content || cf.cf_utm_content || cf['UTM Content'] || null,
      utm_term: c.utm_term || cf.utm_term || cf.cf_utm_term || cf['UTM Term'] || null,
      first_conversion: c.first_conversion?.content || c.first_conversion?.identifier || c.first_conversion_date || null,
      last_conversion: c.last_conversion?.content || c.last_conversion?.identifier || c.last_conversion_date || null,
      created_at: c.created_at || new Date().toISOString()
    };
  });
  let count = 0;
  for (let i = 0; i < contactsData.length; i += 500) {
    const batch = contactsData.slice(i, i + 500);
    const { error } = await sb.from('crm_contacts').upsert(batch, { onConflict: 'rd_station_id' });
    if (!error) count += batch.length;
    else console.error('Contacts upsert error:', error);
  }
  await sb.from('crm_sync_log').insert({ sync_type: 'manual', entity_type: 'contact', status: 'success' });
  return { contacts: count };
}

async function syncDeals(rdToken: string, sb: any) {
  const allDeals = await fetchAllPages(`${RD_API}/deals?token=${rdToken}`, 'deals');
  console.log(`Syncing ${allDeals.length} deals`);
  const { data: stages } = await sb.from('crm_deal_stages').select('id, rd_station_id, pipeline_id, is_won');
  const stageMap = new Map(stages?.map((s: any) => [s.rd_station_id, s]) || []);
  const wonIds = new Set(stages?.filter((s: any) => s.is_won).map((s: any) => s.id) || []);
  const allContacts = await fetchAllFromTable(sb, 'crm_contacts', 'id, rd_station_id, name, email');
  const cById = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));
  const cByName = new Map(allContacts.map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));
  const cByEmail = new Map(allContacts.filter((c: any) => c.email).map((c: any) => [c.email?.toLowerCase()?.trim(), c.id]));
  const { data: profiles } = await sb.from('profiles').select('id, email');
  const emailMap = new Map(profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []);

  // Fetch existing deals for history tracking
  const existingDeals = await fetchAllFromTable(sb, 'crm_deals', 'id, rd_station_id, stage_id');
  const existMap = new Map(existingDeals.map((d: any) => [d.rd_station_id, { id: d.id, stage_id: d.stage_id }]));

  const dealsData = allDeals.map(deal => {
    const si: any = stageMap.get(deal.deal_stage?._id);
    const isWon = deal.win === true || deal.win === 'won' || deal.win === 1 || (si && wonIds.has(si.id));
    let contactId = null;
    if (deal.contacts?.[0]?._id) contactId = cById.get(deal.contacts[0]._id);
    if (!contactId && deal.name) contactId = cByName.get(deal.name?.toLowerCase()?.trim());
    if (!contactId && deal.contacts?.[0]?.emails?.[0]?.email) contactId = cByEmail.get(deal.contacts[0].emails[0].email?.toLowerCase()?.trim());
    let ownerId = deal.user?.email ? emailMap.get(deal.user.email.toLowerCase()) || null : null;
    return {
      rd_station_id: deal._id, contact_id: contactId || null, pipeline_id: si?.pipeline_id || null, stage_id: si?.id || null, owner_id: ownerId,
      name: deal.name || 'Deal sem nome', value: deal.amount_total || 0, expected_close_date: deal.prediction_date || null,
      closed_at: deal.closed_at || (isWon ? (deal.last_activity_at || null) : null), won: isWon,
      loss_reason: deal.loss_reason || null, product_name: deal.deal_products?.[0]?.name || null, campaign_name: deal.campaign?.name || null,
      notes: deal.notes || null, custom_fields: deal.custom_fields || {}, created_at: deal.created_at || new Date().toISOString()
    };
  });

  let count = 0;
  for (let i = 0; i < dealsData.length; i += 500) {
    const batch = dealsData.slice(i, i + 500);
    const { error } = await sb.from('crm_deals').upsert(batch, { onConflict: 'rd_station_id' });
    if (!error) count += batch.length;
    else console.error('Deals upsert error:', error);
  }

  // Stage change history
  const hist: any[] = [];
  for (const d of dealsData) {
    const ex = existMap.get(d.rd_station_id);
    if (ex && d.stage_id && ex.stage_id !== d.stage_id) hist.push({ deal_id: ex.id, from_stage_id: ex.stage_id, to_stage_id: d.stage_id });
  }
  if (hist.length) {
    await sb.from('crm_deal_history').insert(hist);
    for (const h of hist) {
      const upd: any = { stage_changed_at: new Date().toISOString() };
      if (wonIds.has(h.to_stage_id)) { upd.closed_at = new Date().toISOString(); upd.won = true; }
      await sb.from('crm_deals').update(upd).eq('id', h.deal_id);
    }
  }

  // Fix deals in won stages missing won=true
  if (wonIds.size > 0) {
    const arr = Array.from(wonIds);
    const { data: fix1 } = await sb.from('crm_deals').select('id, stage_changed_at, updated_at').in('stage_id', arr).eq('won', false);
    for (const d of fix1 || []) await sb.from('crm_deals').update({ won: true, closed_at: d.stage_changed_at || d.updated_at || new Date().toISOString() }).eq('id', d.id);
    const { data: fix2 } = await sb.from('crm_deals').select('id, stage_changed_at, updated_at').in('stage_id', arr).eq('won', true).is('closed_at', null);
    for (const d of fix2 || []) await sb.from('crm_deals').update({ closed_at: d.stage_changed_at || d.updated_at || new Date().toISOString() }).eq('id', d.id);
  }

  await sb.from('crm_sync_log').insert({ sync_type: 'manual', entity_type: 'deal', status: 'success' });
  return { deals: count, stage_transitions: hist.length };
}

async function syncActivities(rdToken: string, sb: any) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const { data: recentDeals } = await sb.from('crm_deals').select('id, rd_station_id, contact_id').or(`created_at.gte.${cutoff.toISOString()},closed_at.gte.${cutoff.toISOString()}`).order('created_at', { ascending: false }).limit(200);
  const dealMap = new Map<string, any>((recentDeals || []).map((d: any) => [d.rd_station_id, { id: d.id, contact_id: d.contact_id }]));
  const allContacts = await fetchAllFromTable(sb, 'crm_contacts', 'id, rd_station_id, name');
  const cById = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));
  const cByName = new Map(allContacts.map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));
  const { data: profiles } = await sb.from('profiles').select('id, email');
  const emailMap = new Map(profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []);

  let allTasks: any[] = [];
  for (const done of [false, true]) {
    let page = 1;
    while (page <= 30) {
      try {
        const r = await fetch(`${RD_API}/tasks?token=${rdToken}&page=${page}&limit=200&done=${done}`);
        if (!r.ok) break;
        const d = await r.json();
        const items = d.tasks || [];
        if (!items.length) break;
        allTasks = allTasks.concat(items);
        if (d.has_more === false || items.length < 200) break;
        page++;
      } catch { break; }
    }
  }
  console.log(`Total tasks: ${allTasks.length}`);
  if (!allTasks.length) return { activities: 0 };

  const seen = new Set<string>();
  const data = allTasks.filter(t => t._id && !seen.has(t._id) && seen.add(t._id)).map(t => {
    let dealId = null, contactId = null;
    if (t.deal?._id) { const di = dealMap.get(t.deal._id); if (di) { dealId = di.id; contactId = di.contact_id; } }
    if (!contactId && t.contact?._id) contactId = cById.get(t.contact._id);
    if (!contactId && t.contact?.name) contactId = cByName.get(t.contact.name?.toLowerCase()?.trim());
    let ownerId = null;
    const email = t.users?.[0]?.email || t.user?.email;
    if (email) ownerId = emailMap.get(email.toLowerCase()) || null;
    return {
      rd_station_id: t._id, deal_id: dealId, contact_id: contactId, owner_id: ownerId,
      type: mapTaskType(t.type), title: t.subject || t.name || 'Tarefa sem título',
      description: t.notes || t.description || null, due_date: t.date || t.due_date || null,
      completed: t.done === true, completed_at: t.done_date || null,
      status: t.done === true ? 'completed' : 'pending',
      created_at: t.created_at || new Date().toISOString()
    };
  });

  let count = 0;
  for (let i = 0; i < data.length; i += 500) {
    const batch = data.slice(i, i + 500);
    const { error } = await sb.from('crm_activities').upsert(batch, { onConflict: 'rd_station_id' });
    if (!error) count += batch.length;
    else console.error('Tasks upsert error:', error);
  }
  await sb.from('crm_sync_log').insert({ sync_type: 'manual', entity_type: 'activity', status: 'success' });
  return { activities: count, completed: data.filter(a => a.completed).length };
}

async function fetchContactActivities(rdToken: string, sb: any, data: any) {
  const { contact_id, deal_rd_station_ids } = data;
  if (!contact_id && (!deal_rd_station_ids?.length)) return { activities: [] };
  const { data: profiles } = await sb.from('profiles').select('id, email, full_name');
  const emailMap = new Map<string, any>(profiles?.map((p: any) => [p.email?.toLowerCase(), { id: p.id, full_name: p.full_name }]) || []);
  let allTasks: any[] = [];
  if (deal_rd_station_ids?.length) {
    for (const did of deal_rd_station_ids) {
      if (!did) continue;
      try {
        const r = await fetch(`${RD_API}/tasks?token=${rdToken}&deal_id=${did}&limit=200`);
        if (r.ok) { const d = await r.json(); allTasks = allTasks.concat(d.tasks || []); }
      } catch {}
    }
  }
  const seen = new Set<string>();
  const unique = allTasks.filter(t => t._id && !seen.has(t._id) && seen.add(t._id));
  const transformed = unique.map(t => {
    let ownerName = null;
    const email = t.users?.[0]?.email || t.user?.email;
    if (email) { const p = emailMap.get(email.toLowerCase()); ownerName = p?.full_name || t.users?.[0]?.name || email; }
    return { id: t._id, rd_station_id: t._id, type: mapTaskType(t.type), title: t.subject || t.name || 'Tarefa sem título', description: t.notes || t.description || null, due_date: t.date || t.due_date || null, completed: t.done === true, completed_at: t.done_date || null, created_at: t.created_at || new Date().toISOString(), owner_name: ownerName, deal_name: t.deal?.name || null };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (transformed.length && contact_id) {
    for (const a of transformed) {
      let ownerId = null;
      if (a.owner_name) { for (const [, p] of emailMap) { if (p.full_name === a.owner_name) { ownerId = p.id; break; } } }
      await sb.from('crm_activities').upsert({ rd_station_id: a.rd_station_id, contact_id, type: a.type, title: a.title, description: a.description, due_date: a.due_date, completed: a.completed, completed_at: a.completed_at, created_at: a.created_at, owner_id: ownerId }, { onConflict: 'rd_station_id' });
    }
  }
  return { activities: transformed };
}

async function createContact(rdToken: string, sb: any, data: any) {
  const { name, email, phone, company, job_title, city, state, website, linkedin, notes } = data;
  if (!name?.trim()) throw new Error('Nome é obrigatório');
  const rd: any = { name: name.trim() };
  if (email) rd.emails = [{ email: email.trim() }];
  if (phone) rd.phones = [{ phone: phone.trim() }];
  if (company) rd.organization = company.trim();
  if (job_title) rd.title = job_title.trim();
  if (website) rd.website = website.trim();
  if (linkedin) rd.linkedin = linkedin.trim();
  if (notes) rd.notes = notes.trim();
  const r = await fetch(`${RD_API}/contacts?token=${rdToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rd) });
  let rdId: string | null = null;
  if (r.ok) { const rc = await r.json(); rdId = rc._id || rc.id; } else { await r.text(); }
  const cd: any = { name: name.trim(), email: email?.trim() || null, phone: phone?.trim() || null, company: company?.trim() || null, job_title: job_title?.trim() || null, city: city?.trim() || null, state: state?.trim() || null, website: website?.trim() || null, linkedin: linkedin?.trim() || null, notes: notes?.trim() || null, updated_at: new Date().toISOString() };
  if (rdId) cd.rd_station_id = rdId;
  const { data: ins, error } = await sb.from('crm_contacts').insert(cd).select().single();
  if (error) throw new Error('Erro ao salvar contato: ' + error.message);
  return { contact: ins, synced_to_rd: !!rdId, rd_station_id: rdId };
}

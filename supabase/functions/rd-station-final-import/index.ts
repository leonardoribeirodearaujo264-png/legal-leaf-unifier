import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_STATION_API = 'https://crm.rdstation.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');

    if (!rdToken) {
      return new Response(
        JSON.stringify({ error: 'RD_STATION_API_TOKEN not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results = {
      contacts: { fetched: 0, upserted: 0 },
      deals: { fetched: 0, upserted: 0 },
      activities: { fetched: 0, upserted: 0 },
      errors: [] as string[],
    };

    // ==========================================
    // 1. Import ALL contacts
    // ==========================================
    console.log('[final-import] Importing contacts...');
    let contactPage = 1;
    let hasMoreContacts = true;

    while (hasMoreContacts) {
      try {
        const res = await fetch(
          `${RD_STATION_API}/contacts?token=${rdToken}&page=${contactPage}&limit=200`,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!res.ok) {
          results.errors.push(`Contacts page ${contactPage}: HTTP ${res.status}`);
          break;
        }

        const data = await res.json();
        const contacts = data.contacts || data;

        if (!Array.isArray(contacts) || contacts.length === 0) {
          hasMoreContacts = false;
          break;
        }

        results.contacts.fetched += contacts.length;

        for (const c of contacts) {
          const contactData = {
            rd_station_id: String(c._id || c.id),
            name: c.name || 'Sem nome',
            email: c.emails?.[0]?.email || c.email || null,
            phone: c.phones?.[0]?.phone || c.phone || null,
            company: c.organization || null,
            job_title: c.title || c.job_title || null,
            city: c.city || null,
            state: c.state || null,
            country: c.country || null,
            website: c.url || c.website || null,
            linkedin: c.linkedin || null,
            twitter: c.twitter || null,
            facebook: c.facebook || null,
            birthday: c.birthday || null,
            notes: c.notes || null,
            first_conversion: c.first_conversion?.content?.identifier || null,
            last_conversion: c.last_conversion?.content?.identifier || null,
            utm_source: c.custom_fields?.utm_source || null,
            utm_medium: c.custom_fields?.utm_medium || null,
            utm_campaign: c.custom_fields?.utm_campaign || null,
            custom_fields: c.custom_fields || null,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('crm_contacts')
            .upsert(contactData, { onConflict: 'rd_station_id' });

          if (!error) results.contacts.upserted++;
        }

        console.log(`[final-import] Contacts page ${contactPage}: ${contacts.length} processed`);
        contactPage++;
        hasMoreContacts = contacts.length === 200;

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        results.errors.push(`Contacts page ${contactPage}: ${e.message}`);
        break;
      }
    }

    // ==========================================
    // 2. Import ALL deals
    // ==========================================
    console.log('[final-import] Importing deals...');
    let dealPage = 1;
    let hasMoreDeals = true;

    while (hasMoreDeals) {
      try {
        const res = await fetch(
          `${RD_STATION_API}/deals?token=${rdToken}&page=${dealPage}&limit=200`,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!res.ok) {
          results.errors.push(`Deals page ${dealPage}: HTTP ${res.status}`);
          break;
        }

        const data = await res.json();
        const deals = data.deals || data;

        if (!Array.isArray(deals) || deals.length === 0) {
          hasMoreDeals = false;
          break;
        }

        results.deals.fetched += deals.length;

        for (const d of deals) {
          // Find local contact by rd_station_id
          let contactId = null;
          if (d.contacts?.[0]?._id) {
            const { data: localContact } = await supabase
              .from('crm_contacts')
              .select('id')
              .eq('rd_station_id', String(d.contacts[0]._id))
              .maybeSingle();
            contactId = localContact?.id || null;
          }

          // Find stage by name
          let stageId = null;
          if (d.deal_stage?.name) {
            const { data: stage } = await supabase
              .from('crm_deal_stages')
              .select('id')
              .eq('name', d.deal_stage.name)
              .maybeSingle();
            stageId = stage?.id || null;
          }

          if (!stageId) {
            // Use first stage as fallback
            const { data: firstStage } = await supabase
              .from('crm_deal_stages')
              .select('id')
              .order('order_index')
              .limit(1)
              .maybeSingle();
            stageId = firstStage?.id;
          }

          const dealData: Record<string, unknown> = {
            rd_station_id: String(d._id || d.id),
            name: d.name || 'Sem nome',
            value: d.amount_total || d.deal_value || 0,
            stage_id: stageId,
            contact_id: contactId,
            owner_id: null,
            product_name: d.deal_products?.[0]?.name || null,
            campaign_name: d.campaign?.name || null,
            notes: d.notes || null,
            won: d.win === 'true' || d.win === true ? true : (d.win === 'false' || d.win === false ? false : null),
            closed_at: d.closed_at || null,
            loss_reason: d.loss_reason || null,
            updated_at: new Date().toISOString(),
          };

          // Map owner by email
          if (d.user?.email) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', d.user.email)
              .maybeSingle();
            dealData.owner_id = profile?.id || null;
          }

          const { error } = await supabase
            .from('crm_deals')
            .upsert(dealData, { onConflict: 'rd_station_id' });

          if (!error) results.deals.upserted++;
        }

        console.log(`[final-import] Deals page ${dealPage}: ${deals.length} processed`);
        dealPage++;
        hasMoreDeals = deals.length === 200;

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        results.errors.push(`Deals page ${dealPage}: ${e.message}`);
        break;
      }
    }

    // ==========================================
    // 3. Import activities for all deals
    // ==========================================
    console.log('[final-import] Importing activities...');
    
    // Get all deals with rd_station_id
    const { data: allDeals } = await supabase
      .from('crm_deals')
      .select('id, rd_station_id, contact_id')
      .not('rd_station_id', 'is', null);

    if (allDeals) {
      for (const deal of allDeals) {
        try {
          const res = await fetch(
            `${RD_STATION_API}/deals/${deal.rd_station_id}/activities?token=${rdToken}&limit=100`,
            { headers: { 'Content-Type': 'application/json' } }
          );

          if (!res.ok) continue;

          const data = await res.json();
          const activities = data.activities || data;

          if (!Array.isArray(activities)) continue;

          for (const a of activities) {
            const activityData = {
              rd_station_id: String(a._id || a.id),
              deal_id: deal.id,
              contact_id: deal.contact_id,
              type: a.type || 'note',
              title: a.text || a.title || a.type || 'Atividade',
              description: a.notes || a.description || null,
              due_date: a.date || null,
              completed: a.done === true,
              completed_at: a.done === true ? (a.date || new Date().toISOString()) : null,
              created_at: a.created_at || new Date().toISOString(),
            };

            const { error } = await supabase
              .from('crm_activities')
              .upsert(activityData, { onConflict: 'rd_station_id' });

            if (!error) results.activities.upserted++;
            results.activities.fetched++;
          }

          // Rate limiting
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          // Continue with next deal
        }
      }
    }

    console.log('[final-import] Complete:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[final-import] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

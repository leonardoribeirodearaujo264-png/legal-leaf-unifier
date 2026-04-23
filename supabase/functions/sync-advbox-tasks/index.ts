import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAdvboxRequest(endpoint: string, retryCount = 0): Promise<any> {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 5;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ADVBOX_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (response.status === 429 && retryCount < maxRetries) {
    const waitTime = Math.pow(2, retryCount) * 2000;
    console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
    await sleep(waitTime);
    return makeAdvboxRequest(endpoint, retryCount + 1);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
    throw new Error('API returned non-JSON response');
  }

  return JSON.parse(responseText);
}

// Determine task status based on API data and local state
function determineStatus(task: any, localCompletedIds: Set<number>): { status: string; completedAt: string | null } {
  const hasCompleted = task.users?.some((u: any) => u.completed !== null);
  const completedUser = task.users?.find((u: any) => u.completed !== null);

  // If API says completed, trust it
  if (hasCompleted) {
    return { status: 'completed', completedAt: completedUser?.completed || new Date().toISOString() };
  }

  // If locally marked as completed, preserve it
  if (localCompletedIds.has(task.id)) {
    return { status: 'completed', completedAt: null }; // keep existing completed_at from DB
  }

  // Check if task is stale (due_date > 90 days in the past)
  if (task.date_deadline || task.date) {
    const dueDate = new Date(task.date_deadline || task.date);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (dueDate < ninetyDaysAgo) {
      return { status: 'stale', completedAt: null };
    }
  }

  return { status: 'pending', completedAt: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let syncType = 'full';
    try {
      const body = await req.json();
      syncType = body?.sync_type || 'full';
    } catch { /* no body */ }

    console.log(`Starting ${syncType} sync of ADVBox tasks...`);

    // Create sync status record
    const { data: syncRecord, error: syncError } = await supabase
      .from('advbox_tasks_sync_status')
      .insert({
        sync_type: syncType,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id, started_at')
      .single();

    if (syncError) {
      console.error('Failed to create sync status:', syncError);
    }

    const syncId = syncRecord?.id;

    // Fetch locally completed task IDs to preserve them
    const localCompletedIds = new Set<number>();
    try {
      const { data: completedTasks } = await supabase
        .from('advbox_tasks')
        .select('advbox_id')
        .eq('status', 'completed');
      if (completedTasks) {
        completedTasks.forEach(t => localCompletedIds.add(t.advbox_id));
      }
      console.log(`Found ${localCompletedIds.size} locally completed tasks to preserve`);
    } catch (e) {
      console.error('Error fetching local completed tasks:', e);
    }

    let allTasks: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = 100;
    const DELAY_BETWEEN_REQUESTS = 2100; // API rate limit: 30 req/min = 1 a cada 2s, margem de segurança

    try {
      while (hasMore && iterations < maxIterations) {
        if (iterations > 0) {
          await sleep(DELAY_BETWEEN_REQUESTS);
        }

        if (syncId) {
          await supabase
            .from('advbox_tasks_sync_status')
            .update({
              last_offset: offset,
              total_synced: allTasks.length,
            })
            .eq('id', syncId);
        }

        console.log(`Fetching tasks offset=${offset}...`);
        const response = await makeAdvboxRequest(`/posts?limit=${limit}&offset=${offset}`);

        const items = response.data || [];
        totalCount = response.totalCount || totalCount || items.length;

        if (items.length === 0) {
          hasMore = false;
        } else {
          allTasks = allTasks.concat(items);
          offset += items.length;
          iterations++;

          if (items.length < limit || allTasks.length >= totalCount) {
            hasMore = false;
          }
        }
      }

      console.log(`Fetched ${allTasks.length} tasks in ${iterations} iterations`);

      // Upsert tasks in batches of 500
      const batchSize = 500;
      let upsertedCount = 0;

      for (let i = 0; i < allTasks.length; i += batchSize) {
        const batch = allTasks.slice(i, i + batchSize).map((task: any) => {
          const assignedUsers = task.users?.map((u: any) => u.name).filter(Boolean) || [];
          const assignedUserIds = task.users?.map((u: any) => ({ id: u.id, name: u.name, completed: u.completed })) || [];

          const { status, completedAt } = determineStatus(task, localCompletedIds);

          const record: any = {
            advbox_id: task.id,
            title: task.task || 'Sem título',
            description: task.notes || null,
            due_date: task.date_deadline || task.date || null,
            status,
            assigned_users: assignedUsers.join(', ') || null,
            assigned_user_ids: assignedUserIds,
            process_number: task.lawsuit?.process_number || null,
            lawsuit_id: task.lawsuit?.id || task.lawsuits_id || null,
            task_type: task.task || null,
            task_type_id: task.tasks_id || null,
            points: 1,
            raw_data: task,
            synced_at: new Date().toISOString(),
          };

          // Only set completed_at if API provides it (don't overwrite local value)
          if (completedAt) {
            record.completed_at = completedAt;
          } else if (status === 'completed' && localCompletedIds.has(task.id)) {
            // Don't include completed_at in upsert to preserve existing value
          } else {
            record.completed_at = null;
          }

          return record;
        });

        const { error: upsertError } = await supabase
          .from('advbox_tasks')
          .upsert(batch, { onConflict: 'advbox_id' });

        if (upsertError) {
          console.error(`Batch upsert error at offset ${i}:`, upsertError);
          throw upsertError;
        }

        upsertedCount += batch.length;
        console.log(`Upserted ${upsertedCount}/${allTasks.length} tasks`);
      }

      // ─── Reconciliation: mark ghost tasks (vanished from API) as completed ─────
      // Safeguards: only run on full sync that received >=80% of expected tasks
      let reconciledCount = 0;
      const reconciliationThreshold = totalCount > 0 ? totalCount * 0.8 : 0;
      const canReconcile =
        syncType === 'full' &&
        allTasks.length >= reconciliationThreshold &&
        allTasks.length > 0;

      if (canReconcile && syncRecord?.started_at) {
        try {
          const seenIds = allTasks.map(t => t.id).filter(Boolean);
          console.log(`Running reconciliation: ${seenIds.length} seen IDs, started_at=${syncRecord.started_at}`);

          // Fetch tasks that should have been touched but weren't (in batches to avoid huge NOT IN)
          const { data: ghostTasks, error: ghostErr } = await supabase
            .from('advbox_tasks')
            .select('id, advbox_id')
            .in('status', ['pending', 'in_progress', 'pendente'])
            .lt('synced_at', syncRecord.started_at);

          if (ghostErr) {
            console.error('Ghost query error:', ghostErr);
          } else if (ghostTasks && ghostTasks.length > 0) {
            const seenSet = new Set(seenIds);
            const toReconcile = ghostTasks.filter(g => !seenSet.has(g.advbox_id));
            console.log(`Found ${toReconcile.length} ghost tasks to reconcile`);

            // Update in chunks of 500
            const chunkSize = 500;
            for (let i = 0; i < toReconcile.length; i += chunkSize) {
              const chunk = toReconcile.slice(i, i + chunkSize).map(t => t.id);
              const { error: updErr } = await supabase
                .from('advbox_tasks')
                .update({
                  status: 'completed',
                  synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .in('id', chunk);
              if (updErr) {
                console.error(`Reconciliation chunk error at ${i}:`, updErr);
              } else {
                reconciledCount += chunk.length;
              }
            }
            console.log(`Reconciled ${reconciledCount} ghost tasks`);
          }
        } catch (reconErr) {
          console.error('Reconciliation failed:', reconErr);
        }
      } else {
        console.log(`Reconciliation skipped: syncType=${syncType}, fetched=${allTasks.length}, threshold=${reconciliationThreshold}`);
      }

      // Update sync status to completed
      if (syncId) {
        await supabase
          .from('advbox_tasks_sync_status')
          .update({
            status: 'completed',
            total_synced: upsertedCount,
            total_count: totalCount,
            reconciled_count: reconciledCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      console.log(`Sync completed: ${upsertedCount} upserted, ${reconciledCount} reconciled`);

      return new Response(
        JSON.stringify({
          success: true,
          total_fetched: allTasks.length,
          total_upserted: upsertedCount,
          total_count: totalCount,
          reconciled: reconciledCount,
          iterations,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Sync error:', errorMsg);

      if (syncId) {
        await supabase
          .from('advbox_tasks_sync_status')
          .update({
            status: 'error',
            last_error: errorMsg,
            total_synced: allTasks.length,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      return new Response(
        JSON.stringify({ error: errorMsg, partial_count: allTasks.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', errorMsg);

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

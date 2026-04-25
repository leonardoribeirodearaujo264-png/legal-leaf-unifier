import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = () => Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Egg Nunes - Avisos <avisos@intraneteggnunes.com.br>";

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildTaskSearchCandidates(userName: string): string[] {
  const normalized = userName.replace(/\s+/g, " ").trim();
  const parts = normalized.split(" ").filter(Boolean);

  return [...new Set([
    normalized,
    parts.slice(0, 4).join(" "),
    parts.slice(0, 3).join(" "),
    parts.slice(0, 2).join(" "),
    parts[0],
  ].filter((candidate) => candidate && candidate.length >= 3))];
}

async function sendEmailViaResend(to: string, subject: string, html: string) {
  const apiKey = RESEND_API_KEY();
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Erro ao enviar email");
  return result;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBaseStyles(): string {
  return `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
      .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 25px 30px; }
      .header h1 { margin: 0; font-size: 22px; }
      .header p { margin: 5px 0 0; opacity: 0.9; font-size: 13px; }
      .content { padding: 25px 30px; }
      .section { margin-bottom: 25px; }
      .section-title { font-size: 16px; font-weight: 700; color: #1f2937; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
      .item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 15px; margin-bottom: 8px; }
      .item-title { font-weight: 600; color: #111827; font-size: 14px; }
      .item-meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
      .badge-red { background: #fef2f2; color: #dc2626; }
      .badge-yellow { background: #fefce8; color: #ca8a04; }
      .badge-green { background: #ecfdf5; color: #059669; }
      .badge-blue { background: #eff6ff; color: #2563eb; }
      .stat-row { display: flex; gap: 15px; margin-bottom: 15px; }
      .stat-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
      .stat-number { font-size: 28px; font-weight: 700; color: #6366f1; }
      .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
      .footer { background: #f9fafb; padding: 15px 30px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; }
      .empty-msg { color: #9ca3af; font-style: italic; font-size: 13px; }
      .button { display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; }
    </style>
  `;
}

interface UserDigestData {
  announcements: any[];
  updates: any[];
  tasks: any[];
  overdueTasks: any[];
  dueSoonTasks: any[];
  publications: any[];
  leads?: { today: number; week: number; bySources: Record<string, number> };
}

async function insertDigestLog(
  supabase: any,
  payload: {
    runId: string;
    profileId?: string;
    userName?: string;
    email?: string;
    position?: string;
    status: string;
    reason?: string;
    details?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("daily_digest_logs").insert({
    run_id: payload.runId,
    profile_id: payload.profileId ?? null,
    user_name: payload.userName ?? null,
    email: payload.email ?? null,
    position: payload.position ?? null,
    status: payload.status,
    reason: payload.reason ?? null,
    details: payload.details ?? {},
  });

  if (error) {
    console.error("[send-daily-digest] Failed to persist daily digest log:", error);
  }
}

function buildDigestHtml(userName: string, data: UserDigestData, baseUrl: string): string {
  const dateStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  
  let sections = "";

  // DJE Publications FIRST (operational priority)
  if (data.publications.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">📰 Movimentações nos seus Processos (${data.publications.length})</div>
        ${data.publications.slice(0, 8).map(p => `
          <div class="item">
            <div class="item-title">${escapeHtml(p.tipo_comunicacao || 'Publicação')} - ${escapeHtml(p.numero_processo || '')}</div>
            <div class="item-meta">${p.tribunal ? `Tribunal: ${escapeHtml(p.tribunal)}` : ''} · ${p.data_publicacao ? formatDate(p.data_publicacao) : ''}</div>
            ${p.conteudo ? `<div class="item-meta" style="margin-top:4px;">${escapeHtml((p.conteudo || '').substring(0, 150))}${(p.conteudo || '').length > 150 ? '...' : ''}</div>` : ''}
          </div>
        `).join("")}
        ${data.publications.length > 8 ? `<p class="item-meta">...e mais ${data.publications.length - 8} publicações</p>` : ""}
        <a href="${baseUrl}/publicacoes-dje" class="button" style="margin-top:10px;">Ver Publicações</a>
      </div>
    `;
  }

  // Overdue tasks
  if (data.overdueTasks.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">🚨 Tarefas Atrasadas (${data.overdueTasks.length})</div>
        ${data.overdueTasks.slice(0, 10).map(t => `
          <div class="item">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">Venceu em: ${t.due_date ? formatDate(t.due_date) : 'Sem data'} · <span class="badge badge-red">Atrasada</span></div>
          </div>
        `).join("")}
        ${data.overdueTasks.length > 10 ? `<p class="item-meta">...e mais ${data.overdueTasks.length - 10} tarefas atrasadas</p>` : ""}
      </div>
    `;
  }

  // Due soon tasks
  if (data.dueSoonTasks.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">⏰ Tarefas com Prazo Próximo (${data.dueSoonTasks.length})</div>
        ${data.dueSoonTasks.slice(0, 10).map(t => `
          <div class="item">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">Vence em: ${t.due_date ? formatDate(t.due_date) : 'Sem data'} · <span class="badge badge-yellow">Próxima</span></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Pending tasks
  if (data.tasks.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">📋 Tarefas Pendentes (${data.tasks.length})</div>
        ${data.tasks.slice(0, 8).map(t => `
          <div class="item">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">${t.due_date ? `Prazo: ${formatDate(t.due_date)}` : 'Sem prazo'} · ${t.process_number ? `Processo: ${t.process_number}` : ''}</div>
          </div>
        `).join("")}
        ${data.tasks.length > 8 ? `<p class="item-meta">...e mais ${data.tasks.length - 8} tarefas</p>` : ""}
      </div>
    `;
  }

  // Messages section removed — notifications are handled in-app only

  // Announcements
  if (data.announcements.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">📢 Novos Comunicados (${data.announcements.length})</div>
        ${data.announcements.slice(0, 5).map(a => `
          <div class="item">
            <div class="item-title">${escapeHtml(a.title)}</div>
            <div class="item-meta">${escapeHtml((a.content || '').substring(0, 120))}${(a.content || '').length > 120 ? '...' : ''}</div>
          </div>
        `).join("")}
        <a href="${baseUrl}/mural-avisos" class="button" style="margin-top:10px;">Ver Mural</a>
      </div>
    `;
  }

  // Updates
  if (data.updates.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">🔄 Atualizações da Intranet (${data.updates.length})</div>
        ${data.updates.map(u => `
          <div class="item">
            <div class="item-title">${escapeHtml(u.title)}</div>
            <div class="item-meta">${escapeHtml(u.description || '')}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Leads (commercial)
  if (data.leads && (data.leads.today > 0 || data.leads.week > 0)) {
    const sourceItems = Object.entries(data.leads.bySources || {}).map(([source, count]) => 
      `<div class="item"><div class="item-title">${escapeHtml(source || 'Direto')}</div><div class="item-meta">${count} lead(s)</div></div>`
    ).join("");

    sections += `
      <div class="section">
        <div class="section-title">📊 Resumo de Leads</div>
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-number">${data.leads.today}</div>
            <div class="stat-label">Ontem</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${data.leads.week}</div>
            <div class="stat-label">Últimos 7 dias</div>
          </div>
        </div>
        ${sourceItems ? `<div class="section-title" style="font-size:14px;">Por Fonte (ontem)</div>${sourceItems}` : ""}
        <a href="${baseUrl}/lead-tracking" class="button" style="margin-top:10px;">Ver Leads</a>
      </div>
    `;
  }

  if (!sections) return "";

  return `
    ${buildBaseStyles()}
    <div class="container">
      <div class="header">
        <h1>📬 Resumo Diário</h1>
        <p>${dateStr}</p>
      </div>
      <div class="content">
        <p style="color: #374151; margin: 0 0 20px;">Olá <strong>${escapeHtml(userName)}</strong>, aqui está seu resumo de hoje:</p>
        ${sections}
      </div>
      <div class="footer">
        Egg Nunes Advogados Associados - Sistema de Gestão Interna<br>
        <small>Para alterar preferências de e-mail, acesse seu perfil na intranet.</small>
      </div>
    </div>
  `;
}

const COMMERCIAL_POSITIONS = ["comercial", "setor_comercial", "marketing"];
const OPERATIONAL_POSITIONS = ["advogado", "estagiario", "paralegal", "operacional", "junior", "pleno", "senior"];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Guarda service-role: sem isso qualquer um com a anon key dispara
  // envio de email em massa pra toda a empresa.
  const authHeader = req.headers.get("Authorization");
  const expectedToken = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (authHeader !== expectedToken) {
    console.error("Tentativa não autorizada em send-daily-digest");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const BASE_URL = "https://intranet-eggnunes.lovable.app";
    const runId = crypto.randomUUID();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString().split("T")[0];
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

    // 1. Get all active, approved, non-suspended profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, position")
      .eq("is_active", true)
      .eq("is_suspended", false)
      .eq("approval_status", "approved");

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No active users found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Get email preferences
    const userIds = profiles.map(p => p.id);
    const { data: allPrefs } = await supabase
      .from("email_notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const prefsMap = new Map(allPrefs?.map(p => [p.user_id, p]) || []);

    // 3. Fetch shared data (announcements, updates, leads)
    const [announcementsRes, updatesRes, leadsTodayRes, leadsWeekRes] = await Promise.all([
      supabase.from("announcements").select("*").gte("created_at", yesterday.toISOString()).order("created_at", { ascending: false }),
      supabase.from("intranet_updates").select("*").gte("created_at", yesterday.toISOString()).order("created_at", { ascending: false }),
      supabase.from("captured_leads").select("id, utm_source, utm_campaign").gte("created_at", yesterday.toISOString()),
      supabase.from("captured_leads").select("id").gte("created_at", weekAgo.toISOString()),
    ]);

    const recentAnnouncements = announcementsRes.data || [];
    const recentUpdates = updatesRes.data || [];
    const leadsToday = leadsTodayRes.data || [];
    const leadsWeek = leadsWeekRes.data || [];

    const leadsBySources: Record<string, number> = {};
    leadsToday.forEach(l => {
      const src = l.utm_source || "Direto";
      leadsBySources[src] = (leadsBySources[src] || 0) + 1;
    });

    // Messages removed from daily digest — handled via in-app notifications only

    // 5. Fetch recent DJE publications (last 7 days for operational)
    const { data: recentPublications } = await supabase
      .from("publicacoes_dje")
      .select("id, numero_processo, tribunal, tipo_comunicacao, data_publicacao, conteudo, nome_advogado")
      .gte("created_at", weekAgo.toISOString())
      .order("data_publicacao", { ascending: false });

    // 6. Process each user
    let sentCount = 0;
    let skippedCount = 0;

    if (!RESEND_API_KEY()) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    for (const profile of profiles) {
      try {
        const userName = (profile.full_name || profile.email || "").trim();
        const position = (profile.position || "").toLowerCase();

        if (!profile.email) {
          skippedCount++;
          await insertDigestLog(supabase, {
            runId,
            profileId: profile.id,
            userName,
            email: profile.email,
            position,
            status: "skipped",
            reason: "missing_email",
            details: { fromEmail: FROM_EMAIL },
          });
          continue;
        }

        const prefs = prefsMap.get(profile.id);
        if (prefs && prefs.notify_daily_digest === false) {
          skippedCount++;
          await insertDigestLog(supabase, {
            runId,
            profileId: profile.id,
            userName,
            email: profile.email,
            position,
            status: "skipped",
            reason: "user_opted_out",
            details: { fromEmail: FROM_EMAIL },
          });
          continue;
        }

        const isCommercial = COMMERCIAL_POSITIONS.some(p => position.includes(p)) || position === 'socio';
        const isOperational = OPERATIONAL_POSITIONS.some(p => position.includes(p));
        const taskCandidates = buildTaskSearchCandidates(userName);

        // --- TASKS: query per user using ilike to bypass 1000-row limit ---
        let tasks: any[] = [];
        for (const candidate of taskCandidates) {
          const { data: userTasks, error: userTasksError } = await supabase
            .from("advbox_tasks")
            .select("id, title, due_date, status, process_number, assigned_users")
            .neq("status", "completed")
            .neq("status", "concluida")
            .ilike("assigned_users", `%${candidate}%`)
            .order("due_date", { ascending: true })
            .limit(100);

          if (userTasksError) throw userTasksError;

          if (userTasks && userTasks.length > 0) {
            const dedupedTasks = new Map<string, any>();
            [...tasks, ...userTasks].forEach((task) => dedupedTasks.set(task.id, task));
            tasks = Array.from(dedupedTasks.values());
          }

          if (tasks.length > 0) break;
        }

        const overdueTasks = tasks.filter(t => t.due_date && t.due_date < nowStr);
        const dueSoonTasks = tasks.filter(t => t.due_date && t.due_date >= nowStr && t.due_date <= threeDaysStr);
        const pendingTasks = tasks.filter(t => !overdueTasks.includes(t) && !dueSoonTasks.includes(t));

        // Messages removed from daily digest

        // --- PUBLICATIONS (operational only — matched by process numbers the user is responsible for) ---
        let userPublications: any[] = [];
        if (isOperational) {
          // Get distinct process numbers from this user's tasks
          const userProcessNumbers = [...new Set(
            tasks
              .filter(t => t.process_number && t.process_number.trim())
              .map(t => t.process_number.trim())
          )];

          if (userProcessNumbers.length > 0) {
            userPublications = (recentPublications || []).filter(p =>
              p.numero_processo && userProcessNumbers.some(pn =>
                p.numero_processo.replace(/[.\-/]/g, '').includes(pn.replace(/[.\-/]/g, ''))
              )
            );
          }
        }

        // --- LEADS (commercial only) ---
        const leadsData = isCommercial ? {
          today: leadsToday.length,
          week: leadsWeek.length,
          bySources: leadsBySources,
        } : undefined;

        // Check if there's any content (relaxed: tasks count too)
        const hasContent =
          overdueTasks.length > 0 ||
          dueSoonTasks.length > 0 ||
          pendingTasks.length > 0 ||
          recentAnnouncements.length > 0 ||
          recentUpdates.length > 0 ||
          userPublications.length > 0 ||
          (isCommercial && leadsWeek.length > 0);

        if (!hasContent) {
          skippedCount++;
          await insertDigestLog(supabase, {
            runId,
            profileId: profile.id,
            userName,
            email: profile.email,
            position,
            status: "skipped",
            reason: "no_content",
            details: {
              fromEmail: FROM_EMAIL,
              isCommercial,
              isOperational,
              taskCandidates,
              taskCount: tasks.length,
              overdueCount: overdueTasks.length,
              dueSoonCount: dueSoonTasks.length,
              pendingCount: pendingTasks.length,
              messageCount: 0,
              announcementCount: recentAnnouncements.length,
              updateCount: recentUpdates.length,
              publicationCount: userPublications.length,
              leadsToday: leadsData?.today ?? 0,
              leadsWeek: leadsData?.week ?? 0,
            },
          });
          console.log(`[send-daily-digest] Skipped ${userName}: no content`, {
            taskCount: tasks.length,
            overdueCount: overdueTasks.length,
            dueSoonCount: dueSoonTasks.length,
            pendingCount: pendingTasks.length,
            messageCount: 0,
            publicationCount: userPublications.length,
            leadsWeek: leadsData?.week ?? 0,
          });
          continue;
        }

        const digestData: UserDigestData = {
          announcements: recentAnnouncements,
          updates: recentUpdates,
          tasks: pendingTasks,
          overdueTasks,
          dueSoonTasks,
          publications: userPublications,
          leads: leadsData,
        };

        const html = buildDigestHtml(userName, digestData, BASE_URL);
        if (!html) { skippedCount++; continue; }

        const subject = `📬 Resumo Diário - ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

        await sendEmailViaResend(profile.email, subject, html);
        sentCount++;
        await insertDigestLog(supabase, {
          runId,
          profileId: profile.id,
          userName,
          email: profile.email,
          position,
          status: "sent",
          reason: "email_sent",
          details: {
            fromEmail: FROM_EMAIL,
            isCommercial,
            isOperational,
            taskCandidates,
            taskCount: tasks.length,
            overdueCount: overdueTasks.length,
            dueSoonCount: dueSoonTasks.length,
            pendingCount: pendingTasks.length,
            messageCount: 0,
            announcementCount: recentAnnouncements.length,
            updateCount: recentUpdates.length,
            publicationCount: userPublications.length,
            leadsToday: leadsData?.today ?? 0,
            leadsWeek: leadsData?.week ?? 0,
          },
        });
        console.log(`[send-daily-digest] Sent to ${userName} <${profile.email}>`, {
          taskCount: tasks.length,
          overdueCount: overdueTasks.length,
          dueSoonCount: dueSoonTasks.length,
          pendingCount: pendingTasks.length,
          messageCount: 0,
          publicationCount: userPublications.length,
          leadsWeek: leadsData?.week ?? 0,
          fromEmail: FROM_EMAIL,
        });

        // Rate limiting: 200ms delay between emails
        await new Promise(r => setTimeout(r, 200));

      } catch (userError) {
        console.error(`[send-daily-digest] Error for user ${profile.id}:`, userError);
        skippedCount++;
        await insertDigestLog(supabase, {
          runId,
          profileId: profile.id,
          userName: (profile.full_name || profile.email || "").trim(),
          email: profile.email,
          position: (profile.position || "").toLowerCase(),
          status: "error",
          reason: "send_failed",
          details: {
            fromEmail: FROM_EMAIL,
            error: userError instanceof Error ? userError.message : String(userError),
          },
        });
      }
    }

    // Log execution
    await supabase.from("email_log").insert({
      to_email: "system",
      subject: "Daily Digest Execution",
      template_type: "daily_digest",
      status: "sent",
      metadata: { runId, sentCount, skippedCount, totalUsers: profiles.length, fromEmail: FROM_EMAIL },
      sent_at: new Date().toISOString(),
    });

    console.log(`[send-daily-digest] Completed: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sentCount, skippedCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[send-daily-digest] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

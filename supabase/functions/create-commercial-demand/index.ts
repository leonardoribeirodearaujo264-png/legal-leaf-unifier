import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHATGURU_BASE = "https://s17.chatguru.app/api/v1";

// =====================================================
// Phone normalization (Brazil) — DDI 55 + DDD válido + 8/9 dígitos
// Retorna apenas dígitos com prefixo 55, ou null se inválido.
// =====================================================
function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Remove zeros à esquerda (resíduo de discagem antiga)
  digits = digits.replace(/^0+/, "");

  // Já vem com DDI 55
  if (digits.startsWith("55") && digits.length >= 12) {
    const rest = digits.slice(2);
    if (rest.length < 10 || rest.length > 11) return null;
    const ddd = parseInt(rest.slice(0, 2), 10);
    if (isNaN(ddd) || ddd < 11 || ddd > 99) return null;
    return digits;
  }

  // Sem DDI: precisa ter DDD(2) + 8 ou 9 dígitos
  if (digits.length === 10 || digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (isNaN(ddd) || ddd < 11 || ddd > 99) return null;
    return "55" + digits;
  }

  return null;
}

// =====================================================
// ChatGuru helper — chama a API e detecta sucesso real
// =====================================================
async function chatguruCall(
  action: string,
  baseParams: Record<string, string>,
  extraParams: Record<string, string> = {}
): Promise<{ ok: boolean; httpStatus: number; raw: any }> {
  const params = new URLSearchParams({ ...baseParams, action, ...extraParams });
  try {
    const resp = await fetch(`${CHATGURU_BASE}?${params.toString()}`, { method: "POST" });
    const text = await resp.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    const okFromBody =
      parsed?.result === "OK" ||
      parsed?.result === "ok" ||
      parsed?.code === 0 ||
      parsed?.success === true ||
      !!parsed?.id ||
      !!parsed?.note_id;
    return { ok: resp.ok && !!okFromBody, httpStatus: resp.status, raw: parsed };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 0,
      raw: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { cliente_advbox_id, cliente_nome, cliente_telefone, user_name } = body;

    if (!cliente_advbox_id || !cliente_nome) {
      return new Response(
        JSON.stringify({ error: "cliente_advbox_id e cliente_nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Config ----------
    const { data: configRows } = await supabase
      .from("comercial_config")
      .select("key, value");
    const cfg: Record<string, string> = {};
    if (configRows) for (const row of configRows) cfg[row.key] = row.value;

    const marcosObrigatorio = cfg["marcos_obrigatorio"] !== "false";
    const setorObrigatorio = cfg["setor_comercial_obrigatorio"] !== "false";
    const chatguruAtivo = cfg["chatguru_ativo"] !== "false";
    const prazoPadraoHoras = parseInt(cfg["prazo_padrao_horas"] || "48", 10);
    const textoObservacao = cfg["texto_observacao_chatguru"] || "Nova análise de caso para o comercial";
    const marcosChatguruId = cfg["marcos_chatguru_id"] || "";
    const setorComercialChatguruId = cfg["setor_comercial_chatguru_id"] || "";

    // ---------- Rodízio ----------
    const { data: vendedores } = await supabase
      .from("comercial_vendedores_config")
      .select("*")
      .eq("ativo", true)
      .order("created_at");

    if (!vendedores || vendedores.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum vendedor ativo configurado para o rodízio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lastDemanda } = await supabase
      .from("comercial_demandas")
      .select("vendedor_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextIndex = 0;
    if (lastDemanda?.vendedor_id) {
      const lastIdx = vendedores.findIndex((v: any) => v.vendedor_id === lastDemanda.vendedor_id);
      nextIndex = lastIdx >= 0 ? (lastIdx + 1) % vendedores.length : 0;
    }
    const selectedVendedor = vendedores[nextIndex];

    const now = new Date();
    const dataFormatada = now.toLocaleDateString("pt-BR");
    const horaFormatada = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const criadorNome = user_name || user.email || "Usuário";
    const vendedorChatguruId = selectedVendedor.chatguru_user_id || "";

    // ---------- Status accumulator ----------
    const status: any = {
      phone_input: cliente_telefone || null,
      phone_normalized: null as string | null,
      chatguru_enabled: chatguruAtivo,
      chat_check: null as any,
      chat_create: { skipped: true } as any,
      note_add: null as any,
      status_open: null as any,
      assignments: [] as any[],
      setor_comercial: { skipped: true, reason: "" } as any,
    };

    // ---------- ChatGuru ----------
    const chatguruKey = Deno.env.get("CHATGURU_API_KEY");
    const chatguruAccountId = Deno.env.get("CHATGURU_ACCOUNT_ID");
    const chatguruPhoneId = Deno.env.get("CHATGURU_PHONE_ID");
    const cgConfigured = !!(chatguruKey && chatguruAccountId && chatguruPhoneId);
    let chatguruNoteId: string | null = null;

    if (!chatguruAtivo) {
      status.chat_check = { skipped: true, reason: "ChatGuru desativado nas configurações" };
    } else if (!cgConfigured) {
      status.chat_check = { skipped: true, reason: "Credenciais ChatGuru não configuradas" };
    } else {
      const phoneNorm = normalizePhoneBR(cliente_telefone);
      status.phone_normalized = phoneNorm;

      if (!phoneNorm) {
        status.chat_check = { skipped: true, reason: "Telefone do cliente inválido ou ausente" };
      } else {
        const baseParams = {
          key: chatguruKey!,
          account_id: chatguruAccountId!,
          phone_id: chatguruPhoneId!,
          chat_number: phoneNorm,
        };

        // 1) chat_check
        const checkRes = await chatguruCall("chat_check", baseParams);
        status.chat_check = { ok: checkRes.ok, httpStatus: checkRes.httpStatus, raw: checkRes.raw };
        console.log("ChatGuru chat_check:", JSON.stringify(checkRes.raw));

        let chatExists = checkRes.ok;
        const rawCheck = checkRes.raw || {};
        if (
          rawCheck.chat_exists === true ||
          rawCheck.exists === true ||
          rawCheck.chat_status === "valid"
        ) {
          chatExists = true;
        }

        // 2) chat_add se não existir
        if (!chatExists) {
          const addRes = await chatguruCall("chat_add", baseParams, {
            name: cliente_nome,
            text: textoObservacao,
          });
          status.chat_create = {
            attempted: true,
            ok: addRes.ok,
            httpStatus: addRes.httpStatus,
            raw: addRes.raw,
          };
          console.log("ChatGuru chat_add:", JSON.stringify(addRes.raw));
          chatExists = addRes.ok;

          if (!addRes.ok) {
            try {
              await supabase.from("integration_sync_log").insert({
                source_table: "comercial_demandas",
                source_id: "00000000-0000-0000-0000-000000000000",
                target_table: "chatguru",
                action: "chat_add_failed",
                details: { phone: phoneNorm, response: addRes.raw },
              } as any);
            } catch (_) { /* noop */ }
          }
        }

        if (chatExists) {
          // 3) note_add
          const noteText = `${textoObservacao} — Cliente: ${cliente_nome} — Criado por: ${criadorNome} em ${dataFormatada} às ${horaFormatada}`;
          const noteRes = await chatguruCall("note_add", baseParams, { note_text: noteText });
          chatguruNoteId = noteRes.raw?.id || noteRes.raw?.note_id || null;
          status.note_add = {
            ok: noteRes.ok,
            httpStatus: noteRes.httpStatus,
            id: chatguruNoteId,
            raw: noteRes.raw,
          };
          console.log("ChatGuru note_add:", JSON.stringify(noteRes.raw));

          // 4) chat_edit -> status open
          const openRes = await chatguruCall("chat_edit", baseParams, { status: "O" });
          status.status_open = { ok: openRes.ok, httpStatus: openRes.httpStatus, raw: openRes.raw };
          console.log("ChatGuru chat_edit (status=O):", JSON.stringify(openRes.raw));

          // 5) Atribuições
          type Assignment = { user_id: string; role: string };
          const toAssign: Assignment[] = [];

          if (vendedorChatguruId) {
            toAssign.push({ user_id: vendedorChatguruId, role: "vendedor" });
          } else {
            status.assignments.push({
              role: "vendedor",
              ok: false,
              skipped: true,
              reason: `Vendedor "${selectedVendedor.vendedor_nome}" sem ID ChatGuru cadastrado`,
            });
          }

          if (marcosObrigatorio) {
            if (marcosChatguruId) {
              toAssign.push({ user_id: marcosChatguruId, role: "marcos" });
            } else {
              status.assignments.push({
                role: "marcos",
                ok: false,
                skipped: true,
                reason: "ID ChatGuru de Marcos não configurado",
              });
            }
          }

          if (setorObrigatorio) {
            if (setorComercialChatguruId) {
              toAssign.push({ user_id: setorComercialChatguruId, role: "setor_comercial" });
              status.setor_comercial = { skipped: false };
            } else {
              status.setor_comercial = {
                skipped: true,
                reason: "ID ChatGuru do Setor Comercial não configurado (não existe usuário com esse perfil no ChatGuru)",
              };
            }
          } else {
            status.setor_comercial = {
              skipped: true,
              reason: "Atribuição de Setor Comercial desativada nas configurações",
            };
          }

          for (const a of toAssign) {
            const r = await chatguruCall("chat_edit", baseParams, { user_id: a.user_id });
            status.assignments.push({
              role: a.role,
              user_id: a.user_id,
              ok: r.ok,
              httpStatus: r.httpStatus,
              raw: r.raw,
            });
            console.log(`ChatGuru assign ${a.role} (${a.user_id}):`, JSON.stringify(r.raw));
          }
        } else {
          status.note_add = { skipped: true, reason: "Chat não existe no ChatGuru e não pôde ser criado" };
          status.status_open = { skipped: true, reason: "Chat indisponível" };
          status.assignments.push({
            role: "all",
            ok: false,
            skipped: true,
            reason: "Chat indisponível — nenhuma atribuição feita",
          });
        }
      }
    }

    // ---------- CRM ----------
    let crmActivityId: string | null = null;
    let crmStatus: any = { ok: false };
    try {
      const { data: crmActivity, error: crmError } = await supabase
        .from("crm_activities")
        .insert({
          type: "task",
          title: `Analisar caso e apresentar proposta — ${cliente_nome}`,
          description: `Nova demanda criada por ${criadorNome} em ${dataFormatada} às ${horaFormatada}. Cliente: ${cliente_nome}. Telefone: ${cliente_telefone || "N/A"}.`,
          owner_id: selectedVendedor.vendedor_id,
          status: "pending",
          due_date: new Date(now.getTime() + prazoPadraoHoras * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (!crmError && crmActivity) {
        crmActivityId = crmActivity.id;
        crmStatus = { ok: true, id: crmActivityId };
      } else {
        crmStatus = { ok: false, error: crmError?.message };
        console.warn("CRM activity error:", crmError);
      }
    } catch (crmErr) {
      crmStatus = { ok: false, error: crmErr instanceof Error ? crmErr.message : String(crmErr) };
      console.error("CRM error (non-blocking):", crmErr);
    }

    // ---------- Persistir demanda ----------
    const { data: demanda, error: demandaError } = await supabase
      .from("comercial_demandas")
      .insert({
        cliente_advbox_id,
        cliente_nome,
        cliente_telefone: cliente_telefone || null,
        vendedor_id: selectedVendedor.vendedor_id,
        vendedor_nome: selectedVendedor.vendedor_nome,
        criado_por: user.id,
        criado_por_nome: criadorNome,
        chatguru_note_id: chatguruNoteId,
        crm_activity_id: crmActivityId,
        status: "aberto",
      })
      .select()
      .single();

    if (demandaError) {
      console.error("Demanda insert error:", demandaError);
      throw demandaError;
    }

    // Log integração (best-effort)
    try {
      await supabase.from("integration_sync_log").insert({
        source_table: "comercial_demandas",
        source_id: demanda.id,
        target_table: "chatguru+crm",
        action: "create_demand",
        details: { chatguru_status: status, crm_status: crmStatus },
      } as any);
    } catch (logErr) {
      console.error("Log insert error (non-blocking):", logErr);
    }

    // ---------- Steps summary para UI ----------
    const stepsSummary: any[] = [
      { key: "demanda", label: "Demanda registrada", ok: true },
      {
        key: "vendedor",
        label: `Vendedor atribuído: ${selectedVendedor.vendedor_nome} (rodízio)`,
        ok: true,
      },
      {
        key: "crm",
        label: "Tarefa criada no CRM",
        ok: !!crmStatus.ok,
        message: crmStatus.ok ? null : crmStatus.error || "Falha ao criar tarefa",
      },
      {
        key: "chatguru_note",
        label: "Anotação no ChatGuru",
        ok: !!status.note_add?.ok,
        skipped: !!status.note_add?.skipped,
        message: status.note_add?.skipped
          ? status.note_add.reason
          : status.note_add?.ok
          ? null
          : "Falha ao adicionar anotação",
      },
      {
        key: "chatguru_status",
        label: "Chat marcado como aberto",
        ok: !!status.status_open?.ok,
        skipped: !!status.status_open?.skipped,
        message: status.status_open?.skipped ? status.status_open.reason : null,
      },
      ...status.assignments.map((a: any) => ({
        key: `assign_${a.role}`,
        label:
          a.role === "vendedor"
            ? "Vendedor atribuído no ChatGuru"
            : a.role === "marcos"
            ? "Marcos atribuído no ChatGuru"
            : a.role === "setor_comercial"
            ? "Setor Comercial atribuído no ChatGuru"
            : `Atribuição (${a.role})`,
        ok: !!a.ok,
        skipped: !!a.skipped,
        message: a.reason || (a.ok ? null : "Falha na atribuição"),
      })),
    ];

    // Setor comercial pulado sem entrar em assignments
    if (
      status.setor_comercial?.skipped &&
      !stepsSummary.find((s) => s.key === "assign_setor_comercial")
    ) {
      stepsSummary.push({
        key: "assign_setor_comercial",
        label: "Setor Comercial atribuído no ChatGuru",
        ok: false,
        skipped: true,
        message: status.setor_comercial.reason,
      });
    }

    const chatguruUsersAssigned = status.assignments.filter((a: any) => a.ok).length;

    return new Response(
      JSON.stringify({
        success: true,
        demanda,
        vendedor_nome: selectedVendedor.vendedor_nome,
        chatguru_registered: !!chatguruNoteId,
        crm_task_created: !!crmActivityId,
        chatguru_users_assigned: chatguruUsersAssigned,
        chatguru_status: status,
        steps_summary: stepsSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

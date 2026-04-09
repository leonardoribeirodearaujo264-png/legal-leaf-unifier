import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(JSON.stringify({ error: "cliente_advbox_id e cliente_nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all dynamic configs
    const { data: configRows } = await supabase
      .from("comercial_config")
      .select("key, value");

    const cfg: Record<string, string> = {};
    if (configRows) {
      for (const row of configRows) cfg[row.key] = row.value;
    }

    const marcosObrigatorio = cfg["marcos_obrigatorio"] !== "false";
    const setorObrigatorio = cfg["setor_comercial_obrigatorio"] !== "false";
    const chatguruAtivo = cfg["chatguru_ativo"] !== "false";
    const prazoPadraoHoras = parseInt(cfg["prazo_padrao_horas"] || "48", 10);
    const textoObservacao = cfg["texto_observacao_chatguru"] || "Nova análise de caso para o comercial";
    const marcosChatguruId = cfg["marcos_chatguru_id"] || "";
    const setorComercialChatguruId = cfg["setor_comercial_chatguru_id"] || "";

    // 1. Round-robin: get active sellers
    const { data: vendedores } = await supabase
      .from("comercial_vendedores_config")
      .select("*")
      .eq("ativo", true)
      .order("created_at");

    if (!vendedores || vendedores.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum vendedor ativo configurado para o rodízio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get last assigned seller
    const { data: lastDemanda } = await supabase
      .from("comercial_demandas")
      .select("vendedor_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

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

    // 2. ChatGuru integration (only if active)
    let chatguruNoteId: string | null = null;
    const chatguruKey = Deno.env.get("CHATGURU_API_KEY");
    const chatguruAccountId = Deno.env.get("CHATGURU_ACCOUNT_ID");
    const chatguruPhoneId = Deno.env.get("CHATGURU_PHONE_ID");

    if (chatguruAtivo && chatguruKey && chatguruAccountId && chatguruPhoneId && cliente_telefone) {
      const cleanPhone = cliente_telefone.replace(/\D/g, "");
      const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

      const noteText = `${textoObservacao} — Cliente: ${cliente_nome} — Criado por: ${criadorNome} em ${dataFormatada} às ${horaFormatada}`;

      try {
        // Add note
        const noteParams = new URLSearchParams({
          key: chatguruKey,
          account_id: chatguruAccountId,
          phone_id: chatguruPhoneId,
          action: "note_add",
          chat_number: phoneWithCountry,
          note_text: noteText,
        });

        const noteResp = await fetch(`https://s17.chatguru.app/api/v1?${noteParams.toString()}`, { method: "POST" });
        const noteData = await noteResp.json();
        chatguruNoteId = noteData?.id || noteData?.note_id || null;
        console.log("ChatGuru note response:", JSON.stringify(noteData));

        // Edit chat: set status to open
        const editParams = new URLSearchParams({
          key: chatguruKey,
          account_id: chatguruAccountId,
          phone_id: chatguruPhoneId,
          action: "chat_edit",
          chat_number: phoneWithCountry,
          status: "O",
        });

        const editResp = await fetch(`https://s17.chatguru.app/api/v1?${editParams.toString()}`, { method: "POST" });
        const editData = await editResp.json();
        console.log("ChatGuru chat_edit (status) response:", JSON.stringify(editData));

        // Assign responsible users based on config
        const userIdsToAssign: string[] = [];
        if (vendedorChatguruId) userIdsToAssign.push(vendedorChatguruId);
        if (marcosObrigatorio && marcosChatguruId) userIdsToAssign.push(marcosChatguruId);
        if (setorObrigatorio && setorComercialChatguruId) userIdsToAssign.push(setorComercialChatguruId);

        for (const chatguruUserId of userIdsToAssign) {
          try {
            const assignParams = new URLSearchParams({
              key: chatguruKey,
              account_id: chatguruAccountId,
              phone_id: chatguruPhoneId,
              action: "chat_edit",
              chat_number: phoneWithCountry,
              user_id: chatguruUserId,
            });

            const assignResp = await fetch(`https://s17.chatguru.app/api/v1?${assignParams.toString()}`, { method: "POST" });
            const assignData = await assignResp.json();
            console.log(`ChatGuru assign user ${chatguruUserId}:`, JSON.stringify(assignData));
          } catch (assignErr) {
            console.error(`ChatGuru assign error for ${chatguruUserId}:`, assignErr);
          }
        }
      } catch (chatguruError) {
        console.error("ChatGuru error (non-blocking):", chatguruError);
      }
    } else {
      console.log("ChatGuru skipped:", chatguruAtivo ? "not configured or no phone" : "disabled by config");
    }

    // 3. CRM activity
    let crmActivityId: string | null = null;
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
      } else {
        console.warn("CRM activity error:", crmError);
      }
    } catch (crmErr) {
      console.error("CRM error (non-blocking):", crmErr);
    }

    // 4. Save demanda locally
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

    const chatguruUsersAssigned = [
      vendedorChatguruId,
      marcosObrigatorio ? marcosChatguruId : "",
      setorObrigatorio ? setorComercialChatguruId : "",
    ].filter(Boolean).length;

    return new Response(
      JSON.stringify({
        success: true,
        demanda,
        vendedor_nome: selectedVendedor.vendedor_nome,
        chatguru_registered: !!chatguruNoteId,
        crm_task_created: !!crmActivityId,
        chatguru_users_assigned: chatguruUsersAssigned,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

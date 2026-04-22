import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Guarda service-role: só pg_cron/internos podem disparar.
  // Mesma checagem usada em advbox-cache-refresh e process-automatic-collections.
  const authHeader = req.headers.get("Authorization");
  const expectedToken = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (authHeader !== expectedToken) {
    console.error("Tentativa não autorizada em cleanup-audit-logs");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Delete audit_log records older than 90 days
    const { count: auditCount, error: auditError } = await supabase
      .from("audit_log")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (auditError) {
      console.error("Erro ao limpar audit_log:", auditError);
    }

    // Delete fin_auditoria records older than 90 days
    const { count: finCount, error: finError } = await supabase
      .from("fin_auditoria")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (finError) {
      console.error("Erro ao limpar fin_auditoria:", finError);
    }

    const result = {
      success: true,
      audit_log_deleted: auditCount || 0,
      fin_auditoria_deleted: finCount || 0,
      timestamp: new Date().toISOString(),
    };

    console.log("Limpeza concluída:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na limpeza:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

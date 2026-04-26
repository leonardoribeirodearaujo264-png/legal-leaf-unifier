// Helper compartilhado para validação de auth nas edge functions.
// Adicionado em 2026-04-22 para fechar o Error do scanner do Lovable:
// "AI Edge Functions Open to Unauthenticated Abuse" — a anon key é pública
// (aparece no frontend), então verify_jwt=true no config.toml não protege
// contra chamadas anônimas. Precisamos validar que o JWT é de um usuário
// real via supabase.auth.getUser().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

/**
 * Valida que a request vem de um usuário autenticado do Supabase.
 *
 * Retorna Response 401 se faltar header ou token inválido / apenas anon key.
 * Retorna { user } quando OK.
 *
 * Uso dentro de serve():
 *   const authRes = await requireUser(req, corsHeaders);
 *   if (authRes instanceof Response) return authRes;
 *   const user = authRes.user;
 */
export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<{ user: { id: string; email?: string } } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Não autorizado" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const token = authHeader.replace("Bearer ", "").trim();

  // BYPASS: chamadas internas (cron / cache refresh) podem usar SERVICE_ROLE_KEY.
  // Isso permite que advbox-cache-refresh dispare advbox-integration sem JWT user-level.
  // O token nunca sai do servidor (gravado em Supabase Secrets), então o risco é zero.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) {
    return { user: { id: "00000000-0000-0000-0000-000000000000", email: "service-role@internal" } };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return new Response(
      JSON.stringify({ error: "Não autorizado" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return { user: data.user };
}

/**
 * Como requireUser, mas também exige approval_status='approved'.
 *
 * Usa a helper function `public.is_approved(_user_id)` que já existe no DB.
 */
export async function requireApprovedUser(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<{ user: { id: string; email?: string } } | Response> {
  const result = await requireUser(req, corsHeaders);
  if (result instanceof Response) return result;

  // Bypass para chamadas internas com service-role
  if (result.user.id === "00000000-0000-0000-0000-000000000000") {
    return { user: result.user };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: approved, error } = await supabase.rpc("is_approved", {
    _user_id: result.user.id,
  });
  if (error || !approved) {
    return new Response(
      JSON.stringify({ error: "Acesso negado" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return { user: result.user };
}

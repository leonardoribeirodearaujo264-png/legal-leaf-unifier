import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireUser(
  req: Request,
  headers: Record<string, string>,
): Promise<{ id: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Configuração de servidor incompleta" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Sessão inválida ou expirada" }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  return { id: user.id };
}

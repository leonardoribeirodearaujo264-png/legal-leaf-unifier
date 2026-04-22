import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Guarda service-role: só pg_cron pode disparar.
  const authHeader = req.headers.get('Authorization');
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (authHeader !== expectedToken) {
    console.error('Tentativa não autorizada em crm-auto-sync');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[crm-auto-sync] Iniciando sincronização automática...');

    const startTime = Date.now();

    // Call crm-sync with full_sync action using service role key
    const response = await fetch(`${supabaseUrl}/functions/v1/crm-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ action: 'full_sync' }),
    });

    const result = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      console.error(`[crm-auto-sync] Erro na sincronização: ${JSON.stringify(result)}`);
      return new Response(
        JSON.stringify({ success: false, error: result, elapsed_seconds: elapsed }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[crm-auto-sync] Sincronização concluída em ${elapsed}s:`, JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, result, elapsed_seconds: elapsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[crm-auto-sync] Erro inesperado:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

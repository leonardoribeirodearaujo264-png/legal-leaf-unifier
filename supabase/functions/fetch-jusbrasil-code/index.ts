import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID');
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft credentials not configured');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const accessToken = await getAccessToken();

    const userEmail = 'rafael@eggnunes.com.br';
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const queryParams = new URLSearchParams({
      '$filter': `receivedDateTime ge ${last24h}`,
      '$orderby': 'receivedDateTime desc',
      '$top': '50',
      '$select': 'subject,body,receivedDateTime,from',
    });
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/messages?${queryParams}`;

    const graphResponse = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('Graph API error:', errorText);
      throw new Error(`Graph API error: ${graphResponse.status}`);
    }

    const data = await graphResponse.json();
    const emails = data.value || [];

    const codes = extractCodes(emails);

    return new Response(JSON.stringify({ codes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching JusBrasil code:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractCodes(emails: any[]): Array<{ code: string; subject: string; receivedAt: string; from: string }> {
  const results: Array<{ code: string; subject: string; receivedAt: string; from: string }> = [];

  for (const email of emails) {
    const fromAddress = (email.from?.emailAddress?.address || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();

    // Only process emails from JusBrasil or with "jusbrasil" in the subject
    if (!fromAddress.includes('jusbrasil') && !subject.includes('jusbrasil')) {
      continue;
    }

    const bodyContent = email.body?.content || '';
    const fullText = email.subject + ' ' + bodyContent;

    const codeMatches = fullText.match(/\b(\d{4,8})\b/g);

    if (codeMatches) {
      const validCodes = codeMatches.filter((c: string) => {
        const num = parseInt(c);
        return c.length >= 4 && c.length <= 8 && num > 999 && !(num >= 1900 && num <= 2100);
      });

      if (validCodes.length > 0) {
        const bestCode = validCodes.find((c: string) => c.length === 6) || validCodes[0];
        results.push({
          code: bestCode,
          subject: email.subject,
          receivedAt: email.receivedDateTime,
          from: fromAddress,
        });
      }
    }
  }

  return results;
}

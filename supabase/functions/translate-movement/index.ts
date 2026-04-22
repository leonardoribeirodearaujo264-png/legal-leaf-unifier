import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { title, titles } = await req.json();
    
    const titlesToTranslate: string[] = titles || (title ? [title] : []);
    
    if (titlesToTranslate.length === 0) {
      throw new Error('No titles provided');
    }

    const translations: { original: string; translated: string }[] = [];

    // Process in batches of 10 for efficiency
    const batchSize = 10;
    for (let i = 0; i < titlesToTranslate.length; i += batchSize) {
      const batch = titlesToTranslate.slice(i, i + batchSize);
      
      const systemInstruction = `Você é um tradutor jurídico especializado em simplificar andamentos processuais para clientes leigos.

REGRAS IMPORTANTES:
- Traduza para linguagem simples e humanizada, sem termos técnicos
- NÃO inclua datas, horários, nomes de partes, valores monetários ou qualquer informação específica de um caso
- A tradução deve ser GENÉRICA e servir para qualquer cliente/processo
- Seja claro e direto, em no máximo 2 frases curtas
- Exemplo: "Audiência de conciliação designada" → "Foi marcada uma audiência para tentar um acordo entre as partes."`;

      const prompt = batch.length === 1
        ? `Traduza este andamento processual:

Andamento: "${batch[0]}"

Responda APENAS com a tradução genérica, sem aspas nem explicações adicionais.`
        : `Traduza cada andamento processual abaixo:

${batch.map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}

Responda no formato:
1. [tradução genérica]
2. [tradução genérica]
...

Sem aspas, sem explicações adicionais.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          system: systemInstruction,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic error:', response.status, errorText);
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      if (batch.length === 1) {
        translations.push({ original: batch[0], translated: content.trim() });
      } else {
        const lines = content.split('\n').filter((l: string) => l.trim());
        batch.forEach((original, idx) => {
          const line = lines[idx] || '';
          const translated = line.replace(/^\d+\.\s*/, '').trim();
          translations.push({ original, translated: translated || 'Tradução não disponível' });
        });
      }
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { fileBase64, fileName } = await req.json();

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing resume: ${fileName}`);

    // Determine MIME type based on file extension
    const getFileMimeType = (filename: string): string => {
      const ext = filename.toLowerCase().split('.').pop();
      switch (ext) {
        case 'pdf':
          return 'application/pdf';
        case 'doc':
          return 'application/msword';
        case 'docx':
          return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        default:
          return 'application/octet-stream';
      }
    };

    const mimeType = getFileMimeType(fileName);
    const fileExtension = fileName.toLowerCase().split('.').pop();
    const fileDescription = fileExtension === 'pdf' ? 'PDF' : 'documento Word';

    const systemPrompt = `Você é um assistente especializado em extrair informações de currículos.
Analise o documento ${fileDescription} fornecido e extraia as seguintes informações:
- Nome completo do candidato
- Email
- Telefone
- Cargo/posição que está aplicando (se mencionado)
- Resumo das qualificações principais

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "full_name": "nome completo",
  "email": "email ou null",
  "phone": "telefone ou null",
  "position_applied": "cargo ou null",
  "summary": "breve resumo das qualificações"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              {
                type: 'file',
                file: {
                  filename: fileName,
                  file_data: `data:${mimeType};base64,${fileBase64}`
                }
              },
              {
                type: 'text',
                text: `Por favor, extraia as informações deste currículo em ${fileDescription}.`
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_resume_data',
              description: 'Extract candidate information from resume',
              parameters: {
                type: 'object',
                properties: {
                  full_name: { type: 'string', description: 'Full name of the candidate' },
                  email: { type: 'string', description: 'Email address', nullable: true },
                  phone: { type: 'string', description: 'Phone number', nullable: true },
                  position_applied: { type: 'string', description: 'Position they are applying for', nullable: true },
                  summary: { type: 'string', description: 'Brief summary of qualifications' }
                },
                required: ['full_name', 'summary'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_resume_data' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to process resume' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data));

    let extractedData = null;
    
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        extractedData = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    if (!extractedData && data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse content JSON:', e);
        }
      }
    }

    if (!extractedData) {
      extractedData = {
        full_name: 'Nome não identificado',
        email: null,
        phone: null,
        position_applied: null,
        summary: 'Não foi possível extrair informações do currículo'
      };
    }

    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing resume:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

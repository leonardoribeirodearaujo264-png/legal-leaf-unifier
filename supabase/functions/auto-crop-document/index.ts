import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CropResult {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
  confidence: number;
  success: boolean;
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const { imageBase64, imageType, originalWidth, originalHeight } = await req.json();

    if (!imageBase64) {
      throw new Error('Imagem não fornecida');
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('API Key não configurada no servidor');
    }

    console.log(`Analisando imagem ${originalWidth}x${originalHeight} para recorte automático`);

    // Use AI to detect document boundaries and suggest crop
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em análise de documentos. Analise a imagem e identifique os limites do documento principal para recorte automático.

A imagem tem dimensões ${originalWidth}x${originalHeight} pixels.

Responda APENAS em JSON válido com esta estrutura exata:
{
  "detected": true/false,
  "cropX": número (coordenada X do início do documento, 0-100% da largura),
  "cropY": número (coordenada Y do início do documento, 0-100% da altura),
  "cropWidth": número (largura do documento, 0-100% da largura),
  "cropHeight": número (altura do documento, 0-100% da altura),
  "rotation": número (0, 90, 180 ou 270 graus para corrigir orientação),
  "confidence": número (0-1, confiança na detecção),
  "documentType": string (tipo de documento detectado)
}

Regras:
- cropX + cropWidth não pode ultrapassar 100
- cropY + cropHeight não pode ultrapassar 100
- Se o documento ocupar toda a imagem, retorne cropX=0, cropY=0, cropWidth=100, cropHeight=100
- Remova bordas, sombras, dedos, superfícies de mesa e margens desnecessárias
- Mantenha apenas o documento principal
- Se não conseguir detectar um documento claro, retorne detected=false`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise esta imagem e detecte os limites do documento para recorte automático. Remova bordas, margens, sombras e qualquer área que não seja parte do documento principal.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API de IA:', errorText);
      return new Response(
        JSON.stringify({
          success: false,
          cropX: 0,
          cropY: 0,
          cropWidth: 100,
          cropHeight: 100,
          rotation: 0,
          confidence: 0,
          message: 'Não foi possível analisar a imagem automaticamente'
        } as CropResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    console.log('Resposta da IA:', content);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Resposta sem JSON válido');
      return new Response(
        JSON.stringify({
          success: false,
          cropX: 0,
          cropY: 0,
          cropWidth: 100,
          cropHeight: 100,
          rotation: 0,
          confidence: 0,
          message: 'Não foi possível detectar o documento'
        } as CropResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize the crop values
    const cropX = Math.max(0, Math.min(100, result.cropX || 0));
    const cropY = Math.max(0, Math.min(100, result.cropY || 0));
    const cropWidth = Math.max(10, Math.min(100 - cropX, result.cropWidth || 100));
    const cropHeight = Math.max(10, Math.min(100 - cropY, result.cropHeight || 100));
    const rotation = [0, 90, 180, 270].includes(result.rotation) ? result.rotation : 0;
    const confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
    const detected = result.detected !== false;

    // Check if the crop actually removes something significant (at least 5% margin)
    const hasSignificantCrop = cropX > 2 || cropY > 2 || cropWidth < 96 || cropHeight < 96;

    console.log(`Detecção: ${detected}, Recorte significativo: ${hasSignificantCrop}, Confiança: ${confidence}`);
    console.log(`Área: x=${cropX}%, y=${cropY}%, w=${cropWidth}%, h=${cropHeight}%, rot=${rotation}°`);

    return new Response(
      JSON.stringify({
        success: detected && confidence > 0.3,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        rotation,
        confidence,
        message: detected ? `Documento detectado (${Math.round(confidence * 100)}% confiança)` : 'Documento não detectado claramente'
      } as CropResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        cropX: 0,
        cropY: 0,
        cropWidth: 100,
        cropHeight: 100,
        rotation: 0,
        confidence: 0,
        message: errorMessage
      } as CropResult),
      { 
        status: 200, // Return 200 with success=false instead of error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { SpellCheck } from 'lucide-react';
import { CorretorUpload } from '@/components/corretor/CorretorUpload';
import { CorretorReport } from '@/components/corretor/CorretorReport';
import { type AnaliseResult, type TipoErro, TIPO_ERRO_CONFIG } from '@/components/corretor/types';
import { streamGemini } from '@/services/geminiService';
import { toast } from 'sonner';

const CHUNK_SIZE = 80_000; // ~20k tokens per chunk — well within Gemini's context window

const SYSTEM_PROMPT = `Você é um revisor especialista em língua portuguesa brasileira (norma culta).
Analise o texto e identifique TODOS os erros gramaticais, ortográficos e de estilo.

Regras:
- Categorize cada erro em: ortografia, concordancia, regencia, pontuacao, crase, acentuacao, coesao, outro
- IGNORE nomes próprios, termos jurídicos técnicos, citações legais, números de processos e artigos de lei
- Para cada erro forneça o trecho exato, a descrição, a sugestão de correção e a localização
- Se não houver erros, retorne lista vazia

Retorne APENAS JSON válido no formato:
{"erros": [{"trecho": "...", "erro": "...", "tipo": "...", "sugestao": "...", "localizacao": "..."}]}`;

async function analyzeChunk(text: string, chunkLabel: string): Promise<any[]> {
  const prompt = `${SYSTEM_PROMPT}

Analise o trecho (${chunkLabel}) abaixo e retorne APENAS o JSON:

${text}`;

  let responseText = '';
  await streamGemini(
    [{ role: 'user', content: prompt }],
    'gemini-2.5-flash',
    (chunk) => { responseText += chunk; },
  );

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { erros?: any[] };
    return (parsed.erros || []).map((e: any) => ({
      ...e,
      localizacao: e.localizacao ? `${chunkLabel} – ${e.localizacao}` : chunkLabel,
    }));
  } catch {
    return [];
  }
}

export default function CorretorPortugues() {
  const [result, setResult] = useState<AnaliseResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAnalyze = async (extractedText: string, fileName: string) => {
    setIsAnalyzing(true);
    setProgress(5);
    setResult(null);

    try {
      const chunks: string[] = [];
      for (let i = 0; i < extractedText.length; i += CHUNK_SIZE) {
        chunks.push(extractedText.slice(i, i + CHUNK_SIZE));
      }

      const totalChunks = chunks.length;
      let allErrors: any[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const label = totalChunks === 1
          ? 'documento completo'
          : `parte ${i + 1} de ${totalChunks}`;

        try {
          const chunkErrors = await analyzeChunk(chunks[i], label);
          allErrors = allErrors.concat(chunkErrors);
        } catch (err) {
          console.error(`Erro ao analisar ${label}:`, err);
          toast.error(`Erro ao analisar ${label}. Tente novamente.`);
        }

        setProgress(Math.round(((i + 1) / totalChunks) * 95));
      }

      const erros = allErrors;
      const resumo: Record<TipoErro, number> = {} as Record<TipoErro, number>;
      for (const tipo of Object.keys(TIPO_ERRO_CONFIG) as TipoErro[]) {
        resumo[tipo] = erros.filter((e: { tipo?: string }) => e.tipo === tipo).length;
      }

      setResult({ erros, resumo, total: erros.length });
      setProgress(100);

      if (erros.length === 0) {
        toast.success('Nenhum erro de português encontrado!');
      } else {
        toast.info(`${erros.length} erro(s) encontrado(s).`);
      }
    } catch (err) {
      console.error('Analyze error:', err);
      toast.error('Erro inesperado. Verifique sua chave Gemini e tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SpellCheck className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Corretor de Português</h1>
          </div>
          <p className="text-muted-foreground">
            Faça upload de um documento PDF ou DOCX para análise gramatical. O sistema identifica
            erros de ortografia, concordância, regência, pontuação, crase, acentuação e coesão textual.
          </p>
        </div>

        <CorretorUpload
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          progress={progress}
        />

        {result && <CorretorReport result={result} />}
      </div>
    </Layout>
  );
}

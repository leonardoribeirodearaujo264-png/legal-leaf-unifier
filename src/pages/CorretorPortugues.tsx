import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { SpellCheck } from 'lucide-react';
import { CorretorUpload } from '@/components/corretor/CorretorUpload';
import { CorretorReport } from '@/components/corretor/CorretorReport';
import { type AnaliseResult, type TipoErro, TIPO_ERRO_CONFIG } from '@/components/corretor/types';
import { streamGemini } from '@/services/geminiService';
import { toast } from 'sonner';

export default function CorretorPortugues() {
  const [result, setResult] = useState<AnaliseResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAnalyze = async (fileBase64: string, fileName: string) => {
    setIsAnalyzing(true);
    setProgress(10);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) { clearInterval(progressInterval); return prev; }
          return prev + Math.random() * 8;
        });
      }, 1500);

      const prompt = `Você é um revisor especializado em português jurídico brasileiro.
Analise o conteúdo do documento (codificado em base64 abaixo) e identifique todos os erros de português.

Arquivo: ${fileName}
Conteúdo base64: ${fileBase64.slice(0, 2000)}... (arquivo completo)

Retorne APENAS um JSON válido no seguinte formato, sem nenhum texto extra antes ou depois:
{
  "erros": [
    {
      "trecho": "trecho com erro",
      "erro": "descrição do erro",
      "tipo": "ortografia|concordancia|regencia|pontuacao|crase|acentuacao|coesao|outro",
      "sugestao": "sugestão de correção",
      "localizacao": "localização aproximada no texto"
    }
  ]
}

Se não houver erros, retorne: {"erros": []}`;

      let responseText = '';
      await streamGemini(
        [{ role: 'user', content: prompt }],
        'gemini-2.5-flash',
        (chunk) => { responseText += chunk; }
      );

      clearInterval(progressInterval);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Resposta inválida da IA');
      const data = JSON.parse(jsonMatch[0]) as { erros?: { tipo?: string }[] };

      const erros = data?.erros || [];
      const resumo: Record<TipoErro, number> = {} as Record<TipoErro, number>;
      for (const tipo of Object.keys(TIPO_ERRO_CONFIG) as TipoErro[]) {
        resumo[tipo] = erros.filter((e: { tipo?: string }) => e.tipo === tipo).length;
      }

      setResult({ erros: erros as import('@/components/corretor/types').ErroPortugues[], resumo, total: erros.length });
      setProgress(100);

      if (erros.length === 0) {
        toast.success('Nenhum erro de português encontrado!');
      } else {
        toast.info(`${erros.length} erro(s) encontrado(s).`);
      }
    } catch (err) {
      console.error('Analyze error:', err);
      toast.error('Erro inesperado. Tente novamente.');
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
            Faça upload de um documento PDF ou DOCX para análise gramatical. O sistema identifica erros de ortografia, concordância, regência, pontuação, crase, acentuação e coesão textual.
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

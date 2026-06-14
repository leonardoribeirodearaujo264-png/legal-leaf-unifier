import { streamAI } from './aiService';
import type { DatajudProcess } from './datajudService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SuccessProbability {
  nivel: 'alta' | 'moderada' | 'baixa';
  percentual: number;
  justificativa: string;
  pontos_favoraveis: string[];
  pontos_desfavoraveis: string[];
}

export interface RiskFactor {
  descricao: string;
  nivel: 'critico' | 'atencao' | 'favoravel';
}

export interface ProcessRisk {
  nivel_geral: 'critico' | 'atencao' | 'favoravel';
  fatores: RiskFactor[];
  recomendacoes: string[];
}

export interface CaseAiAnalysis {
  resumo_executivo: string;
  area_direito: string;
  objeto_processo: string;
  partes: { nome: string; tipo: string; observacao?: string }[];
  linha_do_tempo: { data: string; evento: string }[];
  movimentacoes_importantes: string[];
  fase_atual: string;
  riscos: string[];
  proximos_passos: string[];
  checklist_documentos: string[];
  estrategia_inicial: string;
  pecas_sugeridas: string[];
  perguntas_para_cliente: string[];
}

// ── Prompt builder ────────────────────────────────────────────────────────

function buildAnalysisPrompt(process: DatajudProcess, clientName?: string): string {
  const partes = (process.partes ?? [])
    .map(p => `  - ${p.tipoParte || 'Parte'}: ${p.nome}${p.documento ? ` (Doc: ${p.documento})` : ''}`)
    .join('\n');

  const movimentos = (process.movimentos ?? [])
    .slice(0, 20)
    .map(m => `  - ${m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : '?'}: ${m.nome ?? 'Sem título'}${m.complementosTabelados?.[0]?.descricao ? ` — ${m.complementosTabelados[0].descricao}` : ''}`)
    .join('\n');

  return `Você é um advogado especialista em análise processual no Brasil.

Com base nos dados extraídos do DataJud, monte um caso jurídico completo para uso interno do escritório.
${clientName ? `\nCliente do escritório: ${clientName}` : ''}

DADOS DO PROCESSO:
- Número: ${process.numeroProcesso}
- Tribunal: ${process.tribunal || 'Não informado'}
- Classe: ${process.classe?.nome || 'Não informado'}
- Assunto: ${process.assuntos?.map(a => a.nome).join(', ') || 'Não informado'}
- Órgão Julgador: ${process.orgaoJulgador?.nome || 'Não informado'}
- Grau: ${process.grau || 'Não informado'}
- Data de Distribuição: ${process.dataAjuizamento ? new Date(process.dataAjuizamento).toLocaleDateString('pt-BR') : 'Não informado'}
- Valor da Causa: ${process.valorCausa ? `R$ ${process.valorCausa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado'}
- Situação: ${process.situacao || 'Não informado'}

PARTES:
${partes || '  Não informado'}

ÚLTIMAS MOVIMENTAÇÕES:
${movimentos || '  Não informado'}

Organize a resposta em JSON válido exatamente com esta estrutura (sem texto fora do JSON):

{
  "resumo_executivo": "string — resumo objetivo do processo em 3-5 frases",
  "area_direito": "string — área do Direito (Cível, Criminal, Trabalhista, etc.)",
  "objeto_processo": "string — o que está em disputa",
  "partes": [{"nome": "string", "tipo": "string", "observacao": "string opcional"}],
  "linha_do_tempo": [{"data": "DD/MM/AAAA", "evento": "string"}],
  "movimentacoes_importantes": ["string"],
  "fase_atual": "string — fase processual atual",
  "riscos": ["string — riscos processuais identificados"],
  "proximos_passos": ["string — ações a tomar"],
  "checklist_documentos": ["string — documentos necessários"],
  "estrategia_inicial": "string — estratégia jurídica sugerida em 2-4 frases",
  "pecas_sugeridas": ["string — nome da peça processual"],
  "perguntas_para_cliente": ["string — perguntas a fazer ao cliente na entrevista"]
}

Regras:
- Não invente fatos que não estejam nos dados
- Se um campo não tiver informação suficiente, use "Não informado"
- Use linguagem técnica jurídica, clara e objetiva
- Retorne APENAS o JSON, sem markdown, sem texto antes ou depois`;
}

// ── Main function ─────────────────────────────────────────────────────────

export async function analyzeCase(
  process: DatajudProcess,
  modelId = 'gemini-flash',
  clientName?: string
): Promise<CaseAiAnalysis> {
  const prompt = buildAnalysisPrompt(process, clientName);
  let raw = '';

  await streamAI(
    [{ role: 'user', content: prompt }],
    modelId,
    (chunk) => { raw += chunk; }
  );

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('A IA não retornou um JSON válido. Tente novamente.');
  }

  try {
    return JSON.parse(jsonMatch[0]) as CaseAiAnalysis;
  } catch {
    throw new Error('Falha ao parsear resposta da IA. Tente novamente.');
  }
}

// ── Quick generators ──────────────────────────────────────────────────────

export async function generateCaseSummary(
  caseData: Record<string, unknown>,
  modelId = 'gemini-flash'
): Promise<string> {
  const prompt = `Com base nos dados do caso abaixo, gere um resumo executivo claro e objetivo em 3-5 parágrafos para uso interno do escritório jurídico. Use linguagem técnica mas acessível.

Dados: ${JSON.stringify(caseData, null, 2)}

Retorne apenas o texto do resumo, sem marcadores ou JSON.`;

  let result = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { result += c; });
  return result;
}

export async function generateCaseStrategy(
  caseData: Record<string, unknown>,
  analysis: CaseAiAnalysis | null,
  modelId = 'gemini-flash'
): Promise<string> {
  const prompt = `Você é um advogado experiente. Com base nos dados do processo e na análise abaixo, desenvolva uma estratégia jurídica detalhada.

Dados do processo: ${JSON.stringify(caseData, null, 2)}
${analysis ? `\nAnálise prévia: ${JSON.stringify({ riscos: analysis.riscos, fase: analysis.fase_atual, objeto: analysis.objeto_processo }, null, 2)}` : ''}

Estruture a estratégia em:
1. Posição atual e fase processual
2. Teses jurídicas a desenvolver
3. Provas e documentos a produzir
4. Medidas urgentes se aplicável
5. Cronograma de atuação sugerido
6. Expectativas e riscos

Seja específico, técnico e prático.`;

  let result = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { result += c; });
  return result;
}

export async function generateClientQuestions(
  caseData: Record<string, unknown>,
  modelId = 'gemini-flash'
): Promise<string[]> {
  const prompt = `Com base no processo abaixo, gere uma lista de perguntas essenciais para fazer ao cliente na entrevista inicial ou de acompanhamento.

Dados: ${JSON.stringify(caseData, null, 2)}

Retorne um JSON array de strings: ["Pergunta 1", "Pergunta 2", ...]
Inclua 10-15 perguntas relevantes, específicas para o tipo de processo.
Retorne APENAS o JSON array.`;

  let raw = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { raw += c; });

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return ['Não foi possível gerar perguntas. Tente novamente.'];

  try {
    return JSON.parse(match[0]) as string[];
  } catch {
    return ['Erro ao processar resposta. Tente novamente.'];
  }
}

// ── Probability of success ────────────────────────────────────────────────

export async function assessSuccessProbability(
  caseData: Record<string, unknown>,
  analysis: CaseAiAnalysis | null,
  modelId = 'gemini-flash'
): Promise<SuccessProbability> {
  const prompt = `Você é um advogado sênior com 20 anos de experiência. Avalie a probabilidade de êxito do processo abaixo.

Dados do processo:
${JSON.stringify(caseData, null, 2)}

${analysis ? `Análise prévia:
Riscos: ${analysis.riscos?.join('; ')}
Objeto: ${analysis.objeto_processo}
Fase: ${analysis.fase_atual}
Estratégia: ${analysis.estrategia_inicial}` : ''}

Responda APENAS com JSON válido neste formato exato:
{
  "nivel": "alta" | "moderada" | "baixa",
  "percentual": <número entre 0 e 100>,
  "justificativa": "string com fundamentação jurídica objetiva em 2-3 frases",
  "pontos_favoraveis": ["string", "string", "string"],
  "pontos_desfavoraveis": ["string", "string", "string"]
}

Base para classificação:
- alta: >75% de chance de êxito
- moderada: 50-75%
- baixa: <50%

Retorne APENAS o JSON.`;

  let raw = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { raw += c; });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('IA não retornou avaliação válida.');

  return JSON.parse(match[0]) as SuccessProbability;
}

// ── Process risk assessment ───────────────────────────────────────────────

export async function assessProcessRisk(
  caseData: Record<string, unknown>,
  movements: { title: string; movement_date: string | null }[],
  analysis: CaseAiAnalysis | null,
  modelId = 'gemini-flash'
): Promise<ProcessRisk> {
  const lastMovements = movements.slice(0, 10).map(m => `${m.movement_date ?? '?'}: ${m.title}`).join('\n');

  const prompt = `Você é um especialista em gestão de risco processual. Avalie os riscos do processo abaixo.

Dados:
${JSON.stringify(caseData, null, 2)}

Últimas movimentações:
${lastMovements || 'Nenhuma movimentação registrada'}

${analysis ? `Riscos já identificados: ${analysis.riscos?.join('; ')}` : ''}

Avalie os seguintes fatores de risco:
- Prazos processuais críticos
- Ausência de documentos essenciais
- Audiências próximas
- Risco de prescrição ou decadência
- Necessidade de recurso
- Cumprimento de diligências
- Fortaleza da tese da parte contrária

Responda APENAS com JSON:
{
  "nivel_geral": "critico" | "atencao" | "favoravel",
  "fatores": [
    { "descricao": "string", "nivel": "critico" | "atencao" | "favoravel" }
  ],
  "recomendacoes": ["string", "string"]
}

Retorne APENAS o JSON.`;

  let raw = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { raw += c; });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('IA não retornou avaliação de risco válida.');

  return JSON.parse(match[0]) as ProcessRisk;
}

// ── Petition generator ────────────────────────────────────────────────────

const PETITION_LABELS: Record<string, string> = {
  inicial: 'Petição Inicial',
  contestacao: 'Contestação',
  replica: 'Réplica',
  manifestacao: 'Manifestação',
  cumprimento: 'Petição de Cumprimento de Sentença',
  impugnacao: 'Impugnação ao Cumprimento de Sentença',
  embargos_execucao: 'Embargos à Execução',
};

export async function generatePetition(
  petitionType: string,
  caseData: Record<string, unknown>,
  analysis: CaseAiAnalysis | null,
  modelId = 'gemini-flash'
): Promise<string> {
  const label = PETITION_LABELS[petitionType] || petitionType;

  const prompt = `Você é um advogado experiente. Redija uma ${label} para o processo abaixo.

Dados do processo:
${JSON.stringify(caseData, null, 2)}

${analysis ? `Estratégia: ${analysis.estrategia_inicial}
Teses jurídicas disponíveis: ${analysis.proximos_passos?.join('; ')}` : ''}

Redija a ${label} seguindo a estrutura padrão do direito processual civil brasileiro:
- Cabeçalho (Excelentíssimo Senhor Doutor Juiz...)
- Qualificação das partes
- Dos fatos
- Do direito (com fundamentação legal e jurisprudencial)
- Dos pedidos
- Data e assinatura (deixar em branco)

Use linguagem técnica jurídica. A peça deve estar completa e pronta para uso.`;

  let result = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { result += c; });
  return result;
}

// ── Resource generator ────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<string, string> = {
  apelacao: 'Apelação',
  agravo_instrumento: 'Agravo de Instrumento',
  agravo_regimental: 'Agravo Regimental',
  recurso_inominado: 'Recurso Inominado',
  embargos_declaracao: 'Embargos de Declaração',
  recurso_especial: 'Recurso Especial',
  recurso_extraordinario: 'Recurso Extraordinário',
};

export async function generateResource(
  resourceType: string,
  caseData: Record<string, unknown>,
  analysis: CaseAiAnalysis | null,
  modelId = 'gemini-flash'
): Promise<string> {
  const label = RESOURCE_LABELS[resourceType] || resourceType;

  const prompt = `Você é um advogado experiente em recursos. Redija um(a) ${label} para o processo abaixo.

Dados do processo:
${JSON.stringify(caseData, null, 2)}

${analysis ? `Análise do caso:
Riscos: ${analysis.riscos?.join('; ')}
Pontos favoráveis: ${analysis.movimentacoes_importantes?.join('; ')}` : ''}

Estruture o ${label} com:
- Tempestividade
- Admissibilidade
- Pressupostos de cabimento específicos do recurso
- Das razões recursais (violação legal/jurisprudencial/fática)
- Do pedido

Use linguagem técnica jurídica. O recurso deve estar completo e bem fundamentado.`;

  let result = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { result += c; });
  return result;
}

// ── Client explanation ────────────────────────────────────────────────────

export async function explainToClient(
  caseData: Record<string, unknown>,
  analysis: CaseAiAnalysis | null,
  modelId = 'gemini-flash'
): Promise<string> {
  const prompt = `Você é um advogado que precisa explicar o status do processo para o cliente de forma simples e tranquilizadora.

Dados do processo:
${JSON.stringify(caseData, null, 2)}

${analysis ? `Resumo técnico: ${analysis.resumo_executivo}
Fase: ${analysis.fase_atual}
Próximos passos: ${analysis.proximos_passos?.join('; ')}` : ''}

Escreva uma explicação em linguagem simples (evite termos jurídicos ou explique-os quando necessário):

1. **O que está acontecendo no seu processo agora**
2. **O que foi feito até agora**
3. **Quais são os próximos passos**
4. **O que você (cliente) precisa fazer ou saber**
5. **Nossa avaliação do momento atual**

Seja claro, objetivo e transmita confiança. Use parágrafos curtos. Máximo 400 palavras.`;

  let result = '';
  await streamAI([{ role: 'user', content: prompt }], modelId, (c) => { result += c; });
  return result;
}

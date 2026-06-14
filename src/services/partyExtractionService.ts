import type { DatajudParte, DatajudMovimento } from './datajudService';
import { streamAI } from './aiService';

// ── Types ──────────────────────────────────────────────────────────────────

export type PartySource = 'DATAJUD' | 'MOVIMENTACOES' | 'IA' | 'MANUAL';
export type PartyPole = 'ativo' | 'passivo' | 'outro';

export interface ExtractedParty {
  name: string;
  document?: string;
  pole: PartyPole;
  partyType: string;
  source: PartySource;
}

export interface ExtractedLawyer {
  name: string;
  oab?: string;
  partyName?: string;
  source: PartySource;
}

export interface ExtractionResult {
  parties: ExtractedParty[];
  lawyers: ExtractedLawyer[];
  source: PartySource | 'NONE';
  log: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isAutorPole(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return (
    t === 'ativo' ||
    t.includes('autor') ||
    t.includes('reclamant') ||
    t.includes('requerente') ||
    t.includes('impetrante') ||
    t.includes('exequente') ||
    t.includes('promovente') ||
    t.includes('apelante') && !t.includes('apelad')
  );
}

function isReuPole(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return (
    t === 'passivo' ||
    t.includes('réu') ||
    t.includes('reo') ||
    t.includes('reclamad') ||
    t.includes('requerido') ||
    t.includes('impetrado') ||
    t.includes('executad') ||
    t.includes('promovido') ||
    t.includes('apelad')
  );
}

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
}

// ── Step 1: Extract from DataJud partes array ──────────────────────────────

export function extractFromDataJud(
  partes: DatajudParte[]
): Omit<ExtractionResult, 'source'> & { source: 'DATAJUD' | 'NONE' } {
  const log: string[] = [];

  if (!partes || partes.length === 0) {
    log.push('DataJud: nenhuma parte retornada no JSON');
    return { parties: [], lawyers: [], source: 'NONE', log };
  }

  const parties: ExtractedParty[] = partes.map(pt => ({
    name: pt.nome || 'Nome não disponível',
    document: (pt as unknown as { documento?: string }).documento ?? undefined,
    pole: isAutorPole(pt.tipoParte || '') ? 'ativo' : isReuPole(pt.tipoParte || '') ? 'passivo' : 'outro',
    partyType: pt.tipoParte || 'Parte',
    source: 'DATAJUD' as PartySource,
  }));

  const lawyers: ExtractedLawyer[] = partes.flatMap(pt =>
    (pt.advogados || []).map(adv => ({
      name: adv.nome || 'Advogado',
      oab: adv.numeroOAB ?? undefined,
      partyName: pt.nome,
      source: 'DATAJUD' as PartySource,
    }))
  );

  const autorCount = parties.filter(p => p.pole === 'ativo').length;
  const reuCount = parties.filter(p => p.pole === 'passivo').length;
  log.push(`DataJud: ${parties.length} parte(s) encontrada(s) — ${autorCount} autor(es), ${reuCount} réu(s), ${lawyers.length} advogado(s)`);

  return { parties, lawyers, source: 'DATAJUD', log };
}

// ── Step 2: Extract from movement descriptions via regex ───────────────────

export function extractFromMovements(
  movimentos: DatajudMovimento[]
): Omit<ExtractionResult, 'source'> & { source: 'MOVIMENTACOES' | 'NONE' } {
  const log: string[] = [];

  const allText = movimentos
    .map(m => [m.nome || '', ...(m.complementosTabelados || []).map(c => c.descricao || '')].join(' '))
    .join('\n');

  if (!allText.trim()) {
    log.push('Regex: nenhuma descrição nas movimentações');
    return { parties: [], lawyers: [], source: 'NONE', log };
  }

  const parties: ExtractedParty[] = [];
  const lawyers: ExtractedLawyer[] = [];
  const seen = new Set<string>();

  // Polo ativo patterns
  const autorPatterns = [
    /\b(?:autor[a]?|requerente|exequente|reclamante|impetrante|promovente)\s*:\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-záéíóúâêîôûãõçäëïöü\s]{2,60}?)(?=\s*(?:CPF|CNPJ|[-,;()]|RÉU|RÉUA|REU|RÉUS|ADV|\n|$))/gi,
  ];

  // Polo passivo patterns
  const reuPatterns = [
    /\b(?:réu|ré|requerido[a]?|executado[a]?|reclamado[a]?|impetrado[a]?|promovido[a]?)\s*:\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-záéíóúâêîôûãõçäëïöü\s]{2,60}?)(?=\s*(?:CPF|CNPJ|[-,;()]|ADV|\n|$))/gi,
  ];

  // OAB pattern: "Adv: Nome OAB/XX 12345" or "Dr. Nome OAB XX-12345"
  const oabPatterns = [
    /(?:adv\.?|advogado[a]?|dr\.?|dra\.?)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-záéíóúâêîôûãõç\s]{2,50}?)\s+(?:oab|OAB)[\/\s]*([A-Z]{2})[\/\s-]*(\d{3,6})/gi,
    /(?:oab|OAB)[\/\s]*([A-Z]{2})[\/\s-]*(\d{3,6})\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-záéíóúâêîôûãõç\s]{2,50})/gi,
  ];

  for (const pattern of autorPatterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(allText)) !== null) {
      const name = cleanName(m[1]);
      if (name.length > 3 && !seen.has(name)) {
        seen.add(name);
        parties.push({ name, pole: 'ativo', partyType: 'Autor', source: 'MOVIMENTACOES' });
      }
    }
  }

  for (const pattern of reuPatterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(allText)) !== null) {
      const name = cleanName(m[1]);
      if (name.length > 3 && !seen.has(name)) {
        seen.add(name);
        parties.push({ name, pole: 'passivo', partyType: 'Réu', source: 'MOVIMENTACOES' });
      }
    }
  }

  for (const pattern of oabPatterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(allText)) !== null) {
      const [, a, b, c] = m;
      const advName = a && a.length > 2 ? cleanName(a) : (c && c.length > 2 ? cleanName(c) : null);
      const uf = a && a.length === 2 ? a : b;
      const num = b && /^\d+$/.test(b) ? b : c;
      if (advName) {
        lawyers.push({
          name: advName,
          oab: uf && num ? `${uf} ${num}` : undefined,
          source: 'MOVIMENTACOES',
        });
      }
    }
  }

  if (parties.length === 0 && lawyers.length === 0) {
    log.push('Regex: nenhuma parte ou advogado identificado nas movimentações');
    return { parties, lawyers, source: 'NONE', log };
  }

  log.push(`Regex: ${parties.length} parte(s) e ${lawyers.length} advogado(s) identificado(s) nas movimentações`);
  return { parties, lawyers, source: 'MOVIMENTACOES', log };
}

// ── Step 3: Extract via AI from movements ─────────────────────────────────

export async function extractWithAI(
  movimentos: DatajudMovimento[],
  classeProcessual: string,
  assunto: string
): Promise<Omit<ExtractionResult, 'source'> & { source: 'IA' | 'NONE' }> {
  const log: string[] = [];

  const movTexts = movimentos
    .slice(0, 30)
    .map(m => {
      const desc = (m.complementosTabelados || []).map(c => c.descricao).filter(Boolean).join('; ');
      return `• ${m.nome || ''}${desc ? ' — ' + desc : ''}`;
    })
    .join('\n');

  if (!movTexts.trim()) {
    log.push('IA: sem movimentações para análise');
    return { parties: [], lawyers: [], source: 'NONE', log };
  }

  const prompt = `Você é um especialista em análise de processos jurídicos brasileiros.

Analise as movimentações abaixo e identifique as partes do processo.

Classe processual: ${classeProcessual || 'N/A'}
Assunto: ${assunto || 'N/A'}

Movimentações:
${movTexts}

Extraia APENAS o que estiver explicitamente nas movimentações. NÃO invente nomes.

Retorne APENAS JSON válido:
{
  "partes": [
    {
      "nome": "string — nome completo da parte",
      "polo": "ativo" | "passivo" | "outro",
      "tipo": "string — Autor, Réu, Reclamante, etc.",
      "documento": "string ou null — CPF/CNPJ se disponível"
    }
  ],
  "advogados": [
    {
      "nome": "string — nome do advogado",
      "oab": "string ou null — ex: MA 6834",
      "parteRepresentada": "string ou null"
    }
  ]
}

Se não encontrar partes, retorne: {"partes": [], "advogados": []}`;

  try {
    let raw = '';
    await streamAI([{ role: 'user', content: prompt }], 'gemini-flash', (c) => { raw += c; });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.push('IA: resposta não contém JSON válido');
      return { parties: [], lawyers: [], source: 'NONE', log };
    }

    const result = JSON.parse(jsonMatch[0]) as {
      partes: { nome: string; polo: string; tipo: string; documento?: string | null }[];
      advogados: { nome: string; oab?: string | null; parteRepresentada?: string | null }[];
    };

    const parties: ExtractedParty[] = (result.partes || [])
      .filter(p => p.nome && p.nome.length > 2)
      .map(p => ({
        name: cleanName(p.nome),
        document: p.documento ?? undefined,
        pole: (p.polo === 'ativo' || p.polo === 'passivo' ? p.polo : 'outro') as PartyPole,
        partyType: p.tipo || (p.polo === 'ativo' ? 'Autor' : 'Réu'),
        source: 'IA' as PartySource,
      }));

    const lawyers: ExtractedLawyer[] = (result.advogados || [])
      .filter(a => a.nome && a.nome.length > 2)
      .map(a => ({
        name: cleanName(a.nome),
        oab: a.oab ?? undefined,
        partyName: a.parteRepresentada ?? undefined,
        source: 'IA' as PartySource,
      }));

    if (parties.length === 0 && lawyers.length === 0) {
      log.push('IA: não identificou partes nas movimentações');
      return { parties, lawyers, source: 'NONE', log };
    }

    log.push(`IA: ${parties.length} parte(s) e ${lawyers.length} advogado(s) identificado(s)`);
    return { parties, lawyers, source: 'IA', log };
  } catch (err) {
    log.push(`IA: erro ao processar — ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    return { parties: [], lawyers: [], source: 'NONE', log };
  }
}

// ── Pipeline orchestrator ─────────────────────────────────────────────────

export async function runPartyExtractionPipeline(
  datajudPartes: DatajudParte[],
  movimentos: DatajudMovimento[],
  classeProcessual: string,
  assunto: string,
  onStep?: (step: string) => void
): Promise<ExtractionResult> {
  const allLogs: string[] = [];

  // Step 1: DataJud
  onStep?.('Extraindo partes do DataJud…');
  const step1 = extractFromDataJud(datajudPartes);
  allLogs.push(...step1.log);

  if (step1.parties.length > 0) {
    return { ...step1, source: 'DATAJUD', log: allLogs };
  }

  // Step 2: Regex on movements
  onStep?.('Buscando partes nas movimentações…');
  const step2 = extractFromMovements(movimentos);
  allLogs.push(...step2.log);

  if (step2.parties.length > 0) {
    return { ...step2, source: 'MOVIMENTACOES', log: allLogs };
  }

  // Step 3: AI
  onStep?.('Identificando partes com IA…');
  const step3 = await extractWithAI(movimentos, classeProcessual, assunto);
  allLogs.push(...step3.log);

  if (step3.parties.length > 0) {
    return { ...step3, source: 'IA', log: allLogs };
  }

  allLogs.push('Pipeline: nenhuma estratégia identificou as partes — intervenção manual necessária');
  return { parties: [], lawyers: [], source: 'NONE', log: allLogs };
}

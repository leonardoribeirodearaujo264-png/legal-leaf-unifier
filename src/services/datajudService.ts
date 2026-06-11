// ── Types ──────────────────────────────────────────────────────────────────

export interface DatajudParte {
  nome: string;
  tipoParte?: string;
  documento?: string;
  advogados?: { nome: string; numeroOAB?: string }[];
}

export interface DatajudMovimento {
  dataHora?: string;
  nome?: string;
  complementosTabelados?: { descricao?: string }[];
}

export interface DatajudProcess {
  numeroProcesso: string;
  tribunal?: string;
  classe?: { nome?: string };
  assuntos?: { nome?: string }[];
  orgaoJulgador?: { nome?: string; codigoMunicipioIBGE?: string };
  grau?: string;
  dataAjuizamento?: string;
  valorCausa?: number;
  partes?: DatajudParte[];
  movimentos?: DatajudMovimento[];
  situacao?: string;
  _raw?: Record<string, unknown>;
}

export interface DatajudSearchResult {
  found: boolean;
  process: DatajudProcess | null;
  error?: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export async function searchProcessByNumber(processNumber: string): Promise<DatajudSearchResult> {
  let data: { found: boolean; process?: DatajudProcess; error?: string };

  try {
    const resp = await fetch('/api/datajud-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processNumber }),
    });

    data = await resp.json();
  } catch {
    return {
      found: false,
      process: null,
      error: 'Erro de comunicação com o servidor. Tente novamente.',
    };
  }

  if (!data.found) {
    return { found: false, process: null, error: data.error ?? 'Processo não encontrado.' };
  }

  return { found: true, process: data.process ?? null };
}

export async function refreshProcess(processNumber: string): Promise<DatajudSearchResult> {
  return searchProcessByNumber(processNumber);
}

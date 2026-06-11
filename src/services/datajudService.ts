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
  let resp: Response;

  try {
    resp = await fetch('/api/datajud-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processNumber }),
    });
  } catch (err) {
    return {
      found: false,
      process: null,
      error: `Não foi possível alcançar o servidor. Verifique sua conexão. (${err instanceof Error ? err.message : 'erro de rede'})`,
    };
  }

  // Handle non-JSON responses (e.g. Vercel 404 HTML page)
  const contentType = resp.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {
      found: false,
      process: null,
      error: `Endpoint /api/datajud-search retornou HTTP ${resp.status}. Verifique o deploy na Vercel.`,
    };
  }

  const data = await resp.json() as { found: boolean; process?: DatajudProcess; error?: string };

  if (!data.found) {
    return { found: false, process: null, error: data.error ?? 'Processo não encontrado.' };
  }

  return { found: true, process: data.process ?? null };
}

export async function refreshProcess(processNumber: string): Promise<DatajudSearchResult> {
  return searchProcessByNumber(processNumber);
}

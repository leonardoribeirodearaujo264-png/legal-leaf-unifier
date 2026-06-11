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

  // Try to parse as JSON regardless of content-type to get the real error message
  let data: { found: boolean; process?: DatajudProcess; error?: string } | null = null;
  try {
    data = await resp.json() as { found: boolean; process?: DatajudProcess; error?: string };
  } catch {
    // Response is not JSON (e.g. HTML error page from Vercel)
    return {
      found: false,
      process: null,
      error: `Erro no servidor (HTTP ${resp.status}). Verifique se DATAJUD_API_KEY está configurada nas variáveis de ambiente da Vercel.`,
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

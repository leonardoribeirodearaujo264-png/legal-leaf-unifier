/// <reference types="node" />

export const config = { runtime: "edge" };

// ── Tribunal index map ────────────────────────────────────────────────────────

const TRIBUNAL_INDEX: Record<string, string> = {
  "1_00": "api_publica_stf", "2_00": "api_publica_cnj", "3_00": "api_publica_stj",
  "4_01": "api_publica_trf1", "4_02": "api_publica_trf2", "4_03": "api_publica_trf3",
  "4_04": "api_publica_trf4", "4_05": "api_publica_trf5", "4_06": "api_publica_trf6",
  "5_00": "api_publica_tst",
  "5_01": "api_publica_trt1",  "5_02": "api_publica_trt2",  "5_03": "api_publica_trt3",
  "5_04": "api_publica_trt4",  "5_05": "api_publica_trt5",  "5_06": "api_publica_trt6",
  "5_07": "api_publica_trt7",  "5_08": "api_publica_trt8",  "5_09": "api_publica_trt9",
  "5_10": "api_publica_trt10", "5_11": "api_publica_trt11", "5_12": "api_publica_trt12",
  "5_13": "api_publica_trt13", "5_14": "api_publica_trt14", "5_15": "api_publica_trt15",
  "5_16": "api_publica_trt16", "5_17": "api_publica_trt17", "5_18": "api_publica_trt18",
  "5_19": "api_publica_trt19", "5_20": "api_publica_trt20", "5_21": "api_publica_trt21",
  "5_22": "api_publica_trt22", "5_23": "api_publica_trt23", "5_24": "api_publica_trt24",
  "8_01": "api_publica_tjac", "8_02": "api_publica_tjal", "8_03": "api_publica_tjap",
  "8_04": "api_publica_tjam", "8_05": "api_publica_tjba", "8_06": "api_publica_tjce",
  "8_07": "api_publica_tjdft", "8_08": "api_publica_tjes", "8_09": "api_publica_tjgo",
  "8_10": "api_publica_tjma",  "8_11": "api_publica_tjmt", "8_12": "api_publica_tjms",
  "8_13": "api_publica_tjmg",  "8_14": "api_publica_tjpa", "8_15": "api_publica_tjpb",
  "8_16": "api_publica_tjpr",  "8_17": "api_publica_tjpe", "8_18": "api_publica_tjpi",
  "8_19": "api_publica_tjrj",  "8_20": "api_publica_tjrn", "8_21": "api_publica_tjrs",
  "8_22": "api_publica_tjro",  "8_23": "api_publica_tjrr", "8_24": "api_publica_tjsc",
  "8_25": "api_publica_tjse",  "8_26": "api_publica_tjsp", "8_27": "api_publica_tjto",
  "9_01": "api_publica_jmeu",
};

const CNJ_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})$/;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

interface ParsedCNJ {
  normalized: string;
  j: string;
  tt: string;
  index: string | null;
}

function parseCNJ(raw: string): ParsedCNJ | null {
  const cleaned = raw.replace(/\s/g, "");
  const match = cleaned.match(CNJ_REGEX);
  if (!match) return null;
  const j = match[4];
  const tt = match[5].padStart(2, "0");
  return { normalized: cleaned, j, tt, index: TRIBUNAL_INDEX[`${j}_${tt}`] ?? null };
}

/** All indices for a given J (justice branch). */
function indicesByJ(j: string): string[] {
  return Object.entries(TRIBUNAL_INDEX)
    .filter(([k]) => k.startsWith(`${j}_`))
    .map(([, v]) => v);
}

interface DatajudMovimento {
  dataHora?: string;
  nome?: string;
  complementosTabelados?: Array<{ descricao?: string }>;
}

interface DatajudSource {
  numeroProcesso?: unknown;
  tribunal?: unknown;
  classe?: { nome?: string };
  assuntos?: Array<{ nome?: string }>;
  orgaoJulgador?: { nome?: string };
  grau?: unknown;
  dataAjuizamento?: unknown;
  valorCausa?: unknown;
  partes?: unknown[];
  movimentos?: DatajudMovimento[];
  situacao?: unknown;
}

function normalizeSource(src: DatajudSource): Record<string, unknown> {
  const movimentos = [...(src.movimentos ?? [])].sort((a, b) => {
    const da = a.dataHora ? new Date(a.dataHora).getTime() : 0;
    const db = b.dataHora ? new Date(b.dataHora).getTime() : 0;
    return db - da;
  });
  return {
    numeroProcesso: String(src.numeroProcesso ?? ""),
    tribunal: String(src.tribunal ?? ""),
    classe: { nome: src.classe?.nome },
    assuntos: (src.assuntos ?? []).slice(0, 5),
    orgaoJulgador: { nome: src.orgaoJulgador?.nome },
    grau: String(src.grau ?? ""),
    dataAjuizamento: src.dataAjuizamento ? String(src.dataAjuizamento) : undefined,
    valorCausa: typeof src.valorCausa === "number" ? src.valorCausa : undefined,
    partes: src.partes ?? [],
    movimentos,
    situacao: String(src.situacao ?? ""),
    _raw: src,
  };
}

interface SearchResult {
  source: DatajudSource | null;
  /** HTTP status returned by DataJud */
  httpStatus: number;
  /** Total hits reported by Elasticsearch */
  totalHits: number;
  error?: string;
}

/**
 * Tries multiple Elasticsearch query strategies for a single index:
 *  1. match          – DataJud official docs format
 *  2. term.keyword   – exact match on keyword sub-field
 *  3. match_phrase   – phrase-level exact match
 *  4. query_string   – quote-wrapped, handles special chars
 *
 * Returns the first hit found, or null with diagnostics.
 */
async function searchOneIndex(
  baseUrl: string,
  index: string,
  processNumber: string,
  apiKey: string,
  signal: AbortSignal
): Promise<SearchResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Authorization": `ApiKey ${apiKey}`,
  };
  const url = `${baseUrl}/${index}/_search`;

  const queries = [
    // 1. Official DataJud docs format
    { query: { match: { numeroProcesso: processNumber } }, size: 1 },
    // 2. Exact keyword match
    { query: { term: { "numeroProcesso.keyword": processNumber } }, size: 1 },
    // 3. Phrase match (respects token order)
    { query: { match_phrase: { numeroProcesso: processNumber } }, size: 1 },
    // 4. query_string with quotes (handles dots/hyphens)
    {
      query: {
        query_string: {
          query: `"${processNumber}"`,
          fields: ["numeroProcesso"],
          default_operator: "AND",
        },
      },
      size: 1,
    },
  ];

  let lastStatus = 0;

  for (const body of queries) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
      lastStatus = resp.status;

      if (!resp.ok) {
        // Auth failure or server error — no point trying other query types
        const errText = await resp.text().catch(() => "");
        return { source: null, httpStatus: resp.status, totalHits: 0, error: errText.slice(0, 300) };
      }

      const data = await resp.json() as {
        hits?: { hits?: Array<{ _source?: DatajudSource }>; total?: { value?: number } | number };
      };
      const hits = data?.hits?.hits ?? [];
      const total = typeof data?.hits?.total === "number"
        ? data.hits.total
        : (data?.hits?.total as { value?: number })?.value ?? 0;

      if (hits.length > 0) {
        return { source: hits[0]._source ?? null, httpStatus: 200, totalHits: total };
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      // Network error on this query type — try the next one
    }
  }

  return { source: null, httpStatus: lastStatus, totalHits: 0 };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    let body: { processNumber?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ found: false, error: "Body JSON inválido" }, 400);
    }

    const rawNumber = String(body.processNumber ?? "").trim();
    if (!rawNumber) {
      return json({ found: false, error: "processNumber é obrigatório" }, 400);
    }

    const parsed = parseCNJ(rawNumber);
    if (!parsed) {
      return json({ found: false, error: "Número inválido. Use o formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO" }, 422);
    }

    const apiKey = process.env.DATAJUD_API_KEY;
    const baseUrl = process.env.DATAJUD_BASE_URL ?? "https://api-publica.datajud.cnj.jus.br";

    if (!apiKey) {
      return json({
        found: false,
        error: "DATAJUD_API_KEY não configurada. Adicione em Settings → Environment Variables no painel da Vercel e faça um novo deploy.",
      }, 500);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      // ── Priority 1: search in the CNJ-determined index ────────────────────
      const primaryIndex = parsed.index ?? null;
      if (primaryIndex) {
        const result = await searchOneIndex(baseUrl, primaryIndex, parsed.normalized, apiKey, controller.signal);

        if (result.source) {
          clearTimeout(timeoutId);
          return json({ found: true, process: normalizeSource(result.source) });
        }

        // If DataJud returned a non-200 status, surface the real error
        if (result.httpStatus !== 200 && result.httpStatus !== 0) {
          clearTimeout(timeoutId);
          if (result.httpStatus === 401 || result.httpStatus === 403) {
            return json({
              found: false,
              error: `Autenticação recusada pelo DataJud (HTTP ${result.httpStatus}). Verifique se DATAJUD_API_KEY está correta e ativa no painel da Vercel.`,
            }, 502);
          }
          return json({
            found: false,
            error: `DataJud retornou HTTP ${result.httpStatus} para o índice ${primaryIndex}. ${result.error ?? ""}`.trim(),
          }, 502);
        }
      }

      // ── Priority 2: all other tribunals of the same branch (J value) ──────
      const fallbackIndices = indicesByJ(parsed.j).filter(idx => idx !== primaryIndex);

      const batchResults = await Promise.allSettled(
        fallbackIndices.map(idx =>
          searchOneIndex(baseUrl, idx, parsed.normalized, apiKey, controller.signal)
        )
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value.source) {
          clearTimeout(timeoutId);
          return json({ found: true, process: normalizeSource(r.value.source) });
        }
      }

      clearTimeout(timeoutId);

      const tribunalLabel = primaryIndex
        ? primaryIndex.replace("api_publica_", "").toUpperCase()
        : `J=${parsed.j}`;

      return json({
        found: false,
        error: `Processo não encontrado no DataJud. Pesquisado em ${tribunalLabel} e ${fallbackIndices.length} outros tribunais do ramo. Verifique se o número está correto e se o processo já está indexado no DataJud.`,
      });

    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        return json({ found: false, error: "Timeout (25s): DataJud demorou demais. Tente novamente em alguns segundos." }, 504);
      }
      throw err;
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno inesperado";
    return json({ found: false, error: `Erro interno: ${message}` }, 500);
  }
}

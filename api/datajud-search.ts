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

const ALL_INDICES = Object.values(TRIBUNAL_INDEX);

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

/**
 * Converts a raw 20-digit CNJ number (e.g. "08005992420258100082")
 * to the formatted CNJ standard (e.g. "0800599-24.2025.8.10.0082").
 * If the input is already formatted or has an unexpected length, returns it unchanged.
 */
function formatCNJ(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 20) return raw;
  return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16,20)}`;
}

/**
 * Normalises a DataJud date string to ISO 8601.
 * DataJud may return "2025-03-15T00:00:00", "2025-03-15 00:00:00", "2025-03-15", etc.
 * Returns undefined if the value is falsy or unparseable.
 */
function normaliseDate(val: unknown): string | undefined {
  if (!val) return undefined;
  const s = String(val).replace(" ", "T").trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface ParsedCNJ {
  normalized: string;
  j: string;
  tt: string;
  index: string | null;
  /** Raw 20 digits: NNNNNNNDDAAAAJTTOOOO */
  raw20: string;
  /** Process serial number (NNNNNNN) */
  nnnnnnn: string;
}

function parseCNJ(raw: string): ParsedCNJ | null {
  const cleaned = raw.replace(/\s/g, "");
  const m = cleaned.match(CNJ_REGEX);
  if (!m) return null;
  const [, nnnnnnn, dd, aaaa, j, tt, oooo] = m;
  const ttPad = tt.padStart(2, "0");
  return {
    normalized: cleaned,
    j,
    tt: ttPad,
    index: TRIBUNAL_INDEX[`${j}_${ttPad}`] ?? null,
    raw20: `${nnnnnnn}${dd}${aaaa}${j}${ttPad}${oooo}`,
    nnnnnnn,
  };
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
    // Always return the human-readable CNJ format (DataJud sometimes stores raw 20 digits)
    numeroProcesso: formatCNJ(String(src.numeroProcesso ?? "")),
    tribunal: String(src.tribunal ?? ""),
    classe: { nome: src.classe?.nome },
    assuntos: (src.assuntos ?? []).slice(0, 5),
    orgaoJulgador: { nome: src.orgaoJulgador?.nome },
    grau: String(src.grau ?? ""),
    // Normalise date to ISO-8601 so browsers parse it consistently
    dataAjuizamento: normaliseDate(src.dataAjuizamento),
    valorCausa: typeof src.valorCausa === "number" ? src.valorCausa : undefined,
    partes: src.partes ?? [],
    movimentos,
    situacao: String(src.situacao ?? ""),
    _raw: src,
  };
}

/**
 * All Elasticsearch query bodies to try per index (ordered from most to least specific).
 * Using 6 strategies ensures the process is found regardless of how DataJud indexed it.
 */
function buildQueries(p: ParsedCNJ): object[] {
  return [
    // 1. Official DataJud format (match with OR — finds any matching token)
    { query: { match: { numeroProcesso: p.normalized } }, size: 1 },

    // 2. match with AND operator — all tokens must be present
    { query: { match: { numeroProcesso: { query: p.normalized, operator: "and" } } }, size: 1 },

    // 3. Exact keyword — no analysis, verbatim string
    { query: { term: { "numeroProcesso.keyword": p.normalized } }, size: 1 },

    // 4. Phrase match — tokens in order
    { query: { match_phrase: { numeroProcesso: p.normalized } }, size: 1 },

    // 5. query_string with quotes — special chars treated literally
    {
      query: {
        query_string: {
          query: `"${p.normalized}"`,
          fields: ["numeroProcesso", "numeroProcesso.keyword"],
        },
      },
      size: 1,
    },

    // 6. Raw 20-digit number (some systems store without separators)
    { query: { multi_match: { query: p.raw20, fields: ["numeroProcesso", "codigoProcesso", "id"] } }, size: 1 },

    // 7. Wildcard — catches any format variation (slow but thorough)
    { query: { wildcard: { "numeroProcesso.keyword": { value: `*${p.nnnnnnn}*` } } }, size: 1 },
  ];
}

/**
 * Searches a single DataJud index trying all query strategies.
 * Returns the first matching _source found, or null.
 * Never throws — all errors are swallowed so one bad index doesn't block others.
 */
async function searchOneIndex(
  baseUrl: string,
  index: string,
  parsed: ParsedCNJ,
  apiKey: string,
  signal: AbortSignal
): Promise<DatajudSource | null> {
  const url = `${baseUrl}/${index}/_search`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Authorization": `ApiKey ${apiKey}`,
  };

  for (const body of buildQueries(parsed)) {
    try {
      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
      if (!resp.ok) return null; // auth/server error — skip remaining queries for this index
      const data = await resp.json() as { hits?: { hits?: Array<{ _source?: DatajudSource }> } };
      const hits = data?.hits?.hits ?? [];
      if (hits.length > 0) return hits[0]._source ?? null;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err; // propagate timeout
      // Network/parse error — try next query strategy
    }
  }
  return null;
}

/**
 * Runs searchOneIndex on a batch of indices in parallel.
 * Returns the first non-null result found, or null if none.
 */
async function searchBatch(
  baseUrl: string,
  indices: string[],
  parsed: ParsedCNJ,
  apiKey: string,
  signal: AbortSignal
): Promise<DatajudSource | null> {
  const results = await Promise.allSettled(
    indices.map(idx => searchOneIndex(baseUrl, idx, parsed, apiKey, signal))
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value !== null) return r.value;
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    let body: { processNumber?: unknown };
    try { body = await req.json(); }
    catch { return json({ found: false, error: "Body JSON inválido" }, 400); }

    const rawNumber = String(body.processNumber ?? "").trim();
    if (!rawNumber) return json({ found: false, error: "processNumber é obrigatório" }, 400);

    const parsed = parseCNJ(rawNumber);
    if (!parsed) {
      return json({ found: false, error: "Número inválido. Use o formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO" }, 422);
    }

    const apiKey = process.env.DATAJUD_API_KEY;
    const baseUrl = process.env.DATAJUD_BASE_URL ?? "https://api-publica.datajud.cnj.jus.br";

    if (!apiKey) {
      return json({
        found: false,
        error: "DATAJUD_API_KEY não configurada. Adicione em Vercel → Settings → Environment Variables → DATAJUD_API_KEY e faça um novo deploy.",
      }, 500);
    }

    // Global 28-second timeout covering all phases
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    try {
      // ── Phase 1: primary index (CNJ-determined) — try all 7 query strategies
      if (parsed.index) {
        const source = await searchOneIndex(baseUrl, parsed.index, parsed, apiKey, controller.signal);
        if (source) { clearTimeout(timeoutId); return json({ found: true, process: normalizeSource(source) }); }
      }

      // ── Phase 2: ALL other indices of the same justice branch (J value)
      const sameJIndices = ALL_INDICES.filter(idx =>
        idx !== parsed.index &&
        Object.entries(TRIBUNAL_INDEX).some(([k, v]) => v === idx && k.startsWith(`${parsed.j}_`))
      );
      if (sameJIndices.length > 0) {
        const source = await searchBatch(baseUrl, sameJIndices, parsed, apiKey, controller.signal);
        if (source) { clearTimeout(timeoutId); return json({ found: true, process: normalizeSource(source) }); }
      }

      // ── Phase 3: Nuclear — ALL remaining indices (every other tribunal)
      const remainingIndices = ALL_INDICES.filter(idx =>
        idx !== parsed.index && !sameJIndices.includes(idx)
      );

      // Run in batches of 8 to avoid overwhelming the API
      for (let i = 0; i < remainingIndices.length; i += 8) {
        const batch = remainingIndices.slice(i, i + 8);
        const source = await searchBatch(baseUrl, batch, parsed, apiKey, controller.signal);
        if (source) { clearTimeout(timeoutId); return json({ found: true, process: normalizeSource(source) }); }
      }

      clearTimeout(timeoutId);
      return json({
        found: false,
        error: `Processo não encontrado no DataJud após buscar em todos os ${ALL_INDICES.length} tribunais com 7 estratégias de pesquisa. O processo pode ainda não estar indexado no DataJud, ou o número pode estar incorreto.`,
      });

    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        return json({ found: false, error: "Tempo esgotado (28s). O DataJud está lento. Tente novamente em alguns instantes." }, 504);
      }
      throw err;
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno inesperado";
    return json({ found: false, error: `Erro interno: ${msg}` }, 500);
  }
}

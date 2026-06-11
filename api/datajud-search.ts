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

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Outer catch-all so the function ALWAYS returns JSON — never an HTML 500 page.
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
      return json({ found: false, error: "Número de processo inválido. Use o formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO" }, 422);
    }
    if (!parsed.index) {
      return json({ found: false, error: `Tribunal não mapeado (J=${parsed.j}, TT=${parsed.tt}).` }, 422);
    }

    const apiKey = process.env.DATAJUD_API_KEY;
    const baseUrl = process.env.DATAJUD_BASE_URL ?? "https://api-publica.datajud.cnj.jus.br";

    if (!apiKey) {
      return json({
        found: false,
        error: "DATAJUD_API_KEY não configurada. Adicione a variável em Settings → Environment Variables no painel da Vercel e faça um novo deploy.",
      }, 500);
    }

    let datajudResp: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      datajudResp = await fetch(`${baseUrl}/${parsed.index}/_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `ApiKey ${apiKey}`,
        },
        body: JSON.stringify({
          query: { match: { numeroProcesso: parsed.normalized } },
          size: 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return json({
        found: false,
        error: isTimeout ? "Timeout: DataJud não respondeu em 20s." : "Erro ao conectar ao DataJud.",
      }, 502);
    }

    if (!datajudResp.ok) {
      return json({ found: false, error: `DataJud retornou HTTP ${datajudResp.status}.` }, 502);
    }

    let data: { hits?: { hits?: Array<{ _source?: DatajudSource }> } };
    try {
      data = await datajudResp.json();
    } catch {
      return json({ found: false, error: "Resposta inválida do DataJud." }, 502);
    }

    const hits = data?.hits?.hits ?? [];
    if (!hits.length) {
      return json({ found: false, error: "Processo não encontrado no DataJud." });
    }

    const normalized = normalizeSource(hits[0]._source ?? {});
    return json({ found: true, process: normalized });

  } catch (err) {
    // Safety net: guarantees JSON even for unexpected runtime errors.
    const message = err instanceof Error ? err.message : "Erro interno inesperado";
    return json({ found: false, error: `Erro interno: ${message}` }, 500);
  }
}

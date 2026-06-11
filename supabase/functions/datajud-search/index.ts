// Edge Function: datajud-search
// Intermediário seguro entre o frontend e a API pública do DataJud (CNJ).
// A chave de API NUNCA é exposta ao navegador.
//
// Secrets necessários no Supabase Dashboard → Edge Functions → Secrets:
//   DATAJUD_API_KEY  = cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
//   DATAJUD_BASE_URL = https://api-publica.datajud.cnj.jus.br  (opcional, tem default)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Tribunal index map (J_TT → api_publica_xxx) ───────────────────────────

const TRIBUNAL_INDEX: Record<string, string> = {
  "1_00": "api_publica_stf",
  "2_00": "api_publica_cnj",
  "3_00": "api_publica_stj",
  "4_01": "api_publica_trf1", "4_02": "api_publica_trf2",
  "4_03": "api_publica_trf3", "4_04": "api_publica_trf4",
  "4_05": "api_publica_trf5", "4_06": "api_publica_trf6",
  "5_00": "api_publica_tst",
  "5_01": "api_publica_trt1",  "5_02": "api_publica_trt2",
  "5_03": "api_publica_trt3",  "5_04": "api_publica_trt4",
  "5_05": "api_publica_trt5",  "5_06": "api_publica_trt6",
  "5_07": "api_publica_trt7",  "5_08": "api_publica_trt8",
  "5_09": "api_publica_trt9",  "5_10": "api_publica_trt10",
  "5_11": "api_publica_trt11", "5_12": "api_publica_trt12",
  "5_13": "api_publica_trt13", "5_14": "api_publica_trt14",
  "5_15": "api_publica_trt15", "5_16": "api_publica_trt16",
  "5_17": "api_publica_trt17", "5_18": "api_publica_trt18",
  "5_19": "api_publica_trt19", "5_20": "api_publica_trt20",
  "5_21": "api_publica_trt21", "5_22": "api_publica_trt22",
  "5_23": "api_publica_trt23", "5_24": "api_publica_trt24",
  "8_01": "api_publica_tjac",  "8_02": "api_publica_tjal",
  "8_03": "api_publica_tjap",  "8_04": "api_publica_tjam",
  "8_05": "api_publica_tjba",  "8_06": "api_publica_tjce",
  "8_07": "api_publica_tjdft", "8_08": "api_publica_tjes",
  "8_09": "api_publica_tjgo",  "8_10": "api_publica_tjma",
  "8_11": "api_publica_tjmt",  "8_12": "api_publica_tjms",
  "8_13": "api_publica_tjmg",  "8_14": "api_publica_tjpa",
  "8_15": "api_publica_tjpb",  "8_16": "api_publica_tjpr",
  "8_17": "api_publica_tjpe",  "8_18": "api_publica_tjpi",
  "8_19": "api_publica_tjrj",  "8_20": "api_publica_tjrn",
  "8_21": "api_publica_tjrs",  "8_22": "api_publica_tjro",
  "8_23": "api_publica_tjrr",  "8_24": "api_publica_tjsc",
  "8_25": "api_publica_tjse",  "8_26": "api_publica_tjsp",
  "8_27": "api_publica_tjto",
  "9_01": "api_publica_jmeu",
};

// ── CNJ number parser ─────────────────────────────────────────────────────

const CNJ_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})$/;

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
  const index = TRIBUNAL_INDEX[`${j}_${tt}`] ?? null;
  return { normalized: cleaned, j, tt, index };
}

// ── DataJud source normalizer ─────────────────────────────────────────────

interface DatajudParte {
  nome: string;
  tipoParte?: string;
  documento?: string;
  advogados?: { nome: string; numeroOAB?: string }[];
}

interface DatajudMovimento {
  dataHora?: string;
  nome?: string;
  complementosTabelados?: { descricao?: string }[];
}

interface DatajudProcess {
  numeroProcesso: string;
  tribunal?: string;
  classe?: { nome?: string };
  assuntos?: { nome?: string }[];
  orgaoJulgador?: { nome?: string };
  grau?: string;
  dataAjuizamento?: string;
  valorCausa?: number;
  partes?: DatajudParte[];
  movimentos?: DatajudMovimento[];
  situacao?: string;
  _raw?: Record<string, unknown>;
}

function normalizeSource(src: Record<string, unknown>): DatajudProcess {
  const partes = (src.partes as DatajudParte[] | undefined) ?? [];
  const movimentos = (src.movimentos as DatajudMovimento[] | undefined) ?? [];

  const sorted = [...movimentos].sort((a, b) => {
    const da = a.dataHora ? new Date(a.dataHora).getTime() : 0;
    const db = b.dataHora ? new Date(b.dataHora).getTime() : 0;
    return db - da;
  });

  const classeObj = src.classe as { nome?: string } | undefined;
  const assuntos = (src.assuntos as { nome?: string }[] | undefined) ?? [];
  const orgao = src.orgaoJulgador as { nome?: string } | undefined;

  return {
    numeroProcesso: String(src.numeroProcesso ?? ""),
    tribunal: String(src.tribunal ?? ""),
    classe: { nome: classeObj?.nome },
    assuntos: assuntos.slice(0, 5),
    orgaoJulgador: { nome: orgao?.nome },
    grau: String(src.grau ?? ""),
    dataAjuizamento: src.dataAjuizamento ? String(src.dataAjuizamento) : undefined,
    valorCausa: typeof src.valorCausa === "number" ? src.valorCausa : undefined,
    partes,
    movimentos: sorted,
    situacao: String(src.situacao ?? ""),
    _raw: src,
  };
}

// ── JSON response helper ──────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated session
  const authRes = await requireUser(req, corsHeaders);
  if (authRes instanceof Response) return authRes;

  try {
    const body = await req.json() as { processNumber?: string };
    const rawNumber = (body.processNumber ?? "").trim();

    if (!rawNumber) {
      return json({ found: false, error: "processNumber é obrigatório" }, 400);
    }

    // Validate and parse CNJ format
    const parsed = parseCNJ(rawNumber);
    if (!parsed) {
      return json({
        found: false,
        error: "Número de processo inválido. Use o formato CNJ: 0000000-00.0000.0.00.0000",
      }, 422);
    }

    if (!parsed.index) {
      return json({
        found: false,
        error: `Tribunal não mapeado (J=${parsed.j}, TT=${parsed.tt}). Consulte o processo manualmente.`,
      }, 422);
    }

    // Credentials from Supabase Secrets (never exposed to the browser)
    const apiKey = Deno.env.get("DATAJUD_API_KEY");
    const baseUrl = Deno.env.get("DATAJUD_BASE_URL") ?? "https://api-publica.datajud.cnj.jus.br";

    if (!apiKey) {
      console.error("DATAJUD_API_KEY secret not configured");
      return json({ found: false, error: "Serviço DataJud não configurado. Contate o administrador." }, 500);
    }

    const datajudUrl = `${baseUrl}/${parsed.index}/_search`;
    const searchBody = JSON.stringify({
      query: { match: { numeroProcesso: parsed.normalized } },
      size: 1,
    });

    console.log(`[datajud-search] Consulting ${parsed.index} for ${parsed.normalized}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let resp: Response;
    try {
      resp = await fetch(datajudUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `ApiKey ${apiKey}`,
        },
        body: searchBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(`[datajud-search] HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return json({
        found: false,
        error: `DataJud retornou HTTP ${resp.status}. Tente novamente.`,
      }, 502);
    }

    const data = await resp.json() as {
      hits?: { hits?: { _source?: Record<string, unknown> }[] };
    };

    const hits = data?.hits?.hits ?? [];
    if (hits.length === 0) {
      return json({ found: false, error: "Processo não encontrado no DataJud." });
    }

    const source = hits[0]._source as Record<string, unknown>;
    const process = normalizeSource(source);

    console.log(`[datajud-search] Found: ${process.numeroProcesso}`);
    return json({ found: true, process });

  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return json({ found: false, error: "Timeout: DataJud demorou mais de 20s para responder." }, 504);
    }
    console.error("[datajud-search] Unexpected error:", err);
    return json({ found: false, error: "Erro interno ao consultar o DataJud." }, 500);
  }
});

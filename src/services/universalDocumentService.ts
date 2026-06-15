/**
 * Universal Document Service
 *
 * Extrai texto de PDFs, DOCX, XLSX, imagens e arquivos de texto.
 * Todos os agentes do Tribuna IA utilizam este serviço para ler documentos
 * anexados ou fixados nas conversas, eliminando respostas como
 * "não consigo ler PDFs" ou "copie e cole o texto".
 */

export interface ExtractionResult {
  text: string;
  pages?: number;
  /** Método usado para extrair o conteúdo */
  method: 'text' | 'pdf' | 'docx' | 'ocr' | 'spreadsheet';
  fileName: string;
  fileType: string;
  charCount: number;
}

const CHUNK_SIZE = 4000;
/** Mínimo de caracteres para considerar que um PDF tem camada de texto real */
const OCR_THRESHOLD = 300;
/** Máximo de páginas processadas via OCR por vez (evita timeout) */
const MAX_OCR_PAGES = 5;

// ── Utilitários ───────────────────────────────────────────────────────────────

function fileExt(file: File): string {
  return (file.name.split('.').pop() ?? '').toLowerCase();
}

async function readAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => resolve('');
    reader.readAsText(file, 'UTF-8');
  });
}

// ── PDF (pdfjs-dist) ──────────────────────────────────────────────────────────

let pdfjsWorkerSet = false;

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjsWorkerSet) {
    // CDN do unpkg garante compatibilidade exata com a versão instalada
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    pdfjsWorkerSet = true;
  }
  return pdfjs;
}

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pageParts.push(pageText);
  }

  return { text: pageParts.join('\n').trim(), pages: pdf.numPages };
}

async function renderPdfPageToBlob(file: File, pageNum: number): Promise<Blob> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 }); // escala alta = melhor OCR

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob retornou null'))),
      'image/png'
    )
  );
}

// ── OCR (tesseract.js) ────────────────────────────────────────────────────────

async function runOcr(source: File | Blob): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', 1);
  const { data } = await worker.recognize(source);
  await worker.terminate();
  return data.text;
}

// ── DOCX (mammoth) ────────────────────────────────────────────────────────────

async function extractDocxText(file: File): Promise<string> {
  // mammoth tem build específico para browser que usa ArrayBuffer
  const mod = await import('mammoth');
  const mammoth = (mod as unknown as { default: typeof mod }).default ?? mod;
  const buffer = await file.arrayBuffer();
  const result = await (mammoth as unknown as {
    extractRawText(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  }).extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ── XLSX (já incluso no projeto) ──────────────────────────────────────────────

async function extractXlsxText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    return `=== Planilha: ${name} ===\n${csv}`;
  }).join('\n\n');
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Extrai texto de qualquer tipo de arquivo suportado.
 * Nunca lança exceção — retorna texto vazio em caso de falha.
 */
export async function extractFromFile(file: File): Promise<ExtractionResult> {
  const ext = fileExt(file);
  const base: Pick<ExtractionResult, 'fileName' | 'fileType'> = {
    fileName: file.name,
    fileType: ext,
  };

  try {
    // ── Texto puro ────────────────────────────────────────────────────────
    if (
      file.type.startsWith('text/') ||
      ['txt', 'md', 'rtf', 'csv'].includes(ext)
    ) {
      const text = await readAsText(file);
      return { ...base, text, method: 'text', charCount: text.length };
    }

    // ── PDF ───────────────────────────────────────────────────────────────
    if (ext === 'pdf' || file.type === 'application/pdf') {
      const { text, pages } = await extractPdfText(file);

      // PDF com camada de texto legível
      if (text.length >= OCR_THRESHOLD) {
        return { ...base, text, pages, method: 'pdf', charCount: text.length };
      }

      // PDF escaneado — renderiza páginas e aplica OCR
      const pageParts: string[] = [];
      const limit = Math.min(pages, MAX_OCR_PAGES);
      for (let i = 1; i <= limit; i++) {
        try {
          const blob = await renderPdfPageToBlob(file, i);
          pageParts.push(await runOcr(blob));
        } catch {
          // ignora página com falha no OCR
        }
      }
      const ocrText = pageParts.join('\n').trim();
      return { ...base, text: ocrText, pages, method: 'ocr', charCount: ocrText.length };
    }

    // ── DOCX / DOC ────────────────────────────────────────────────────────
    if (['docx', 'doc'].includes(ext) || file.type.includes('word')) {
      const text = await extractDocxText(file);
      return { ...base, text, method: 'docx', charCount: text.length };
    }

    // ── XLSX / XLS ────────────────────────────────────────────────────────
    if (
      ['xlsx', 'xls'].includes(ext) ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel')
    ) {
      const text = await extractXlsxText(file);
      return { ...base, text, method: 'spreadsheet', charCount: text.length };
    }

    // ── Imagens — OCR ─────────────────────────────────────────────────────
    if (
      file.type.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
    ) {
      const text = await runOcr(file);
      return { ...base, text, method: 'ocr', charCount: text.length };
    }

    return { ...base, text: '', method: 'text', charCount: 0 };
  } catch {
    return { ...base, text: '', method: 'text', charCount: 0 };
  }
}

// ── Helpers de contexto ───────────────────────────────────────────────────────

/** Divide texto longo em chunks para indexação */
export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/**
 * Monta bloco de contexto documental para injetar no prompt da IA.
 * Limita cada documento a 8 000 chars para não estourar o contexto.
 */
export function buildDocumentContext(results: ExtractionResult[]): string {
  return results
    .filter((r) => r.text.trim().length > 0)
    .map((r) => `=== ${r.fileName} ===\n${r.text.slice(0, 8000)}`)
    .join('\n\n');
}

/**
 * Regra global que deve ser adicionada ao system prompt de TODOS os agentes.
 * Proíbe respostas do tipo "não consigo ler PDFs".
 */
export const DOCUMENT_RULE =
  'ACESSO A DOCUMENTOS: Você tem acesso integral a todos os documentos ' +
  'processados e incluídos nesta conversa. É proibido afirmar que não consegue ' +
  'ler PDFs, que não tem acesso a anexos, ou que o usuário deve copiar e colar ' +
  'texto. Sempre utilize os documentos disponíveis para responder com precisão. ' +
  'Em caso de falha na extração informe apenas: "Não foi possível extrair o ' +
  'conteúdo deste documento. Tente reenviar uma versão pesquisável ou com melhor qualidade."';

/** Rótulo legível para o método de extração */
export function extractionMethodLabel(method: ExtractionResult['method']): string {
  switch (method) {
    case 'pdf':         return 'PDF';
    case 'docx':        return 'DOCX';
    case 'ocr':         return 'OCR';
    case 'spreadsheet': return 'Planilha';
    case 'text':        return 'Texto';
    default:            return 'Lido';
  }
}

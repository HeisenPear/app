import { getDocumentProxy } from 'unpdf'
import type { Worker } from 'tesseract.js'

/**
 * Browser-only OCR for PDFs whose text is rasterized (image or vector outlines)
 * and therefore not extractable by pdf.js. Each page is rendered to a canvas
 * with pdf.js, then read by Tesseract.js (French model). Everything runs
 * locally on the user's machine — no upload, no server CPU.
 *
 * A single Tesseract worker is created lazily and reused across the whole batch
 * (worker creation downloads the WASM core + language data once, then caches).
 */

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      // 'fra' = French language model (downloaded once from the CDN, then cached)
      const worker = await createWorker('fra')
      // PSM 4 = "Assume a single column of text of variable sizes" — better suited
      // for invoice pages than the default PSM 3 (auto with OSD), which can waste
      // time on orientation detection and produce worse results on vectorized PDFs.
      await worker.setParameters({ tessedit_pageseg_mode: '4' as never })
      return worker
    })()
  }
  return workerPromise
}

/** Release the shared worker once the batch is done. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return
  try {
    const worker = await workerPromise
    await worker.terminate()
  } catch {
    /* ignore */
  } finally {
    workerPromise = null
  }
}

/** Render one PDF page to a canvas at the given scale (higher = better OCR). */
async function renderPageToCanvas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  pageNumber: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D non disponible')
  await page.render({ canvasContext: context, viewport, canvas }).promise
  return canvas
}

export interface OcrCallbacks {
  /** Called before OCR'ing each page. */
  onPage?: (page: number, total: number) => void
  /**
   * Returns true once enough text has been gathered to stop early (avoids
   * OCR'ing every page when the needed fields are already on page 1–2).
   */
  shouldStop?: (accumulatedText: string) => boolean
}

/**
 * OCR a PDF page by page, accumulating text. Stops early when `shouldStop`
 * returns true. Returns the concatenated recognized text.
 */
export async function ocrPdf(
  bytes: Uint8Array,
  { onPage, shouldStop }: OcrCallbacks = {}
): Promise<string> {
  const doc = await getDocumentProxy(bytes)
  const worker = await getWorker()
  const total: number = doc.numPages
  let accumulated = ''

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    onPage?.(pageNumber, total)
    // Scale 3 ≈ 216 dpi (pdf.js base = 72 dpi × 3). Tesseract recommends ≥ 300 dpi
    // for best accuracy; 216 dpi is a pragmatic balance between quality and speed.
    // Scale 2 (144 dpi) produced too many artefacts: dropped decimal commas,
    // merged digits, misread symbols (e.g. "," → "A" in vectorised fonts).
    const canvas = await renderPageToCanvas(doc, pageNumber, 3)
    try {
      const { data } = await worker.recognize(canvas)
      accumulated += '\n' + (data.text || '')
    } finally {
      // Free the canvas backing store promptly.
      canvas.width = 0
      canvas.height = 0
    }
    if (shouldStop?.(accumulated)) break
  }

  return accumulated
}

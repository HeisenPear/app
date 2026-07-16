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

/**
 * Recycle the worker to release the accumulated WebAssembly heap. Tesseract's
 * heap only ever grows across `recognize()` calls; over hundreds of pages (e.g.
 * several 100-page Amazon files in one batch) it can exhaust the tab's memory
 * and make later files silently fail. Terminating and recreating the worker
 * resets the heap; the language data is cached, so re-creation is cheap.
 */
async function recycleWorker(): Promise<void> {
  await terminateOcr()
  await getWorker()
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
  // Release the page's internal render caches so memory doesn't accumulate
  // across a long multi-page document.
  try {
    page.cleanup()
  } catch {
    /* ignore */
  }
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
  /**
   * Render scale (pdf.js base is 72 dpi; scale 3 ≈ 216 dpi, scale 2 ≈ 144 dpi).
   * Higher = more accurate but slower. Defaults to 3 for the small, densely
   * vectorised PrestaShop fonts; callers can lower it for cleaner layouts
   * (e.g. Amazon packing slips) to speed up large multi-page files.
   */
  scale?: number
}

/**
 * OCR a PDF page by page, accumulating text. Stops early when `shouldStop`
 * returns true. Returns the concatenated recognized text.
 */
export async function ocrPdf(
  bytes: Uint8Array,
  { onPage, shouldStop, scale = 3 }: OcrCallbacks = {}
): Promise<string> {
  const doc = await getDocumentProxy(bytes)
  let worker = await getWorker()
  const total: number = doc.numPages
  let accumulated = ''

  // Recycle the worker every N pages to cap the Tesseract WASM heap (see
  // recycleWorker). Chosen well above a typical single invoice so small files
  // never pay the cost, but low enough to keep large multi-file batches bounded.
  const RECYCLE_EVERY = 20

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      onPage?.(pageNumber, total)
      if (pageNumber > 1 && pageNumber % RECYCLE_EVERY === 1) {
        await recycleWorker()
        worker = await getWorker()
      }
    // Default scale 3 ≈ 216 dpi (pdf.js base = 72 dpi × 3). Tesseract recommends
    // ≥ 300 dpi; 216 dpi balances quality and speed. Scale 2 (144 dpi) produced
    // too many artefacts on the small, densely vectorised PrestaShop fonts
    // (dropped decimal commas, merged digits, "," → "A"). Callers may lower the
    // scale for cleaner layouts (Amazon) to speed up large multi-page files.
      const canvas = await renderPageToCanvas(doc, pageNumber, scale)
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
  } finally {
    // Destroy the pdf.js document so its decoded pages are released before the
    // next file loads — otherwise memory accumulates across a multi-file batch.
    try {
      await doc.destroy()
    } catch {
      /* ignore */
    }
  }

  return accumulated
}

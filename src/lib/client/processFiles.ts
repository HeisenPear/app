import JSZip from 'jszip'
import { parseCSV } from '../parsers/csv'
import { parseExcel } from '../parsers/excel'
import { parsePDF, parsePdfTextContent, PDF_NO_TEXT_ERROR } from '../parsers/pdf'
import { ocrPdf, terminateOcr } from './ocr'
import { processOrders } from '../processors/orders'
import { processDisputes } from '../processors/disputes'
import { calculateStats } from '../processors/stats'
import type {
  Order,
  Dispute,
  Company,
  Transporter,
  FileType,
  ProcessedData,
  CompanyReport,
  UploadedFile,
} from '../types'

/**
 * Fully client-side file processing.
 *
 * Every parser used here (unpdf, jszip, papaparse, exceljs) runs in the browser,
 * so we do ALL the heavy work locally on the user's machine instead of pushing
 * megabytes through Vercel's serverless functions (which cap requests at 4.5 MB
 * and time out on large batches). The server only ever receives the small,
 * final JSON report for shared-history persistence.
 *
 * Files are processed one at a time and the loop yields to the event loop
 * between each unit, so a large ZIP (tens of MB / hundreds of invoices) is
 * handled without freezing the UI — the progress bar keeps updating.
 */

export interface ProgressInfo {
  phase: 'extracting' | 'parsing' | 'ocr' | 'finalizing'
  current: string
  done: number
  total: number
}

type ParsedExt = 'csv' | 'xlsx' | 'xls' | 'pdf'

interface Task {
  name: string
  ext: ParsedExt
  company: Company
  fileType: FileType
  transporter?: Transporter
  /** Lazily yields the file bytes (decompresses a ZIP entry on demand). */
  getBytes: () => Promise<Uint8Array>
}

/** Let the browser repaint between units so the progress bar stays live. */
const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function extOf(name: string): string {
  return name.toLowerCase().split('.').pop() || ''
}

function isParsable(ext: string): ext is ParsedExt {
  return ext === 'csv' || ext === 'xlsx' || ext === 'xls' || ext === 'pdf'
}

function isJunkPath(path: string, base: string): boolean {
  return path.startsWith('__MACOSX/') || base.startsWith('._') || base === '.DS_Store'
}

/** Mirror the server-side ZIP parser's filename → transporter heuristic. */
function transporterFromName(name: string): Transporter | undefined {
  const lower = name.toLowerCase()
  if (lower.includes('colissimo') || lower.includes('colis')) return 'colissimo'
  if (lower.includes('dpd')) return 'dpd'
  if (lower.includes('geodis') || lower.includes('geo')) return 'geodis'
  return undefined
}

/**
 * Flatten the uploaded files into a list of parse tasks, expanding ZIPs in the
 * browser. Bytes are read lazily (per task) so we never hold the whole archive
 * decompressed in memory at once.
 */
async function buildTasks(
  uploaded: UploadedFile[],
  onProgress: (p: ProgressInfo) => void
): Promise<Task[]> {
  const tasks: Task[] = []

  for (const uf of uploaded) {
    const ext = extOf(uf.file.name)

    if (ext === 'zip') {
      onProgress({ phase: 'extracting', current: uf.file.name, done: 0, total: 0 })
      const zip = await JSZip.loadAsync(await uf.file.arrayBuffer())

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const base = path.split('/').pop() || path
        if (isJunkPath(path, base)) continue
        const entryExt = extOf(base)
        if (!isParsable(entryExt)) continue

        tasks.push({
          name: base,
          ext: entryExt,
          company: uf.company,
          fileType: uf.fileType,
          transporter: uf.transporter ?? transporterFromName(base),
          getBytes: () => entry.async('uint8array'),
        })
      }
    } else if (isParsable(ext)) {
      tasks.push({
        name: uf.file.name,
        ext,
        company: uf.company,
        fileType: uf.fileType,
        transporter: uf.transporter,
        getBytes: async () => new Uint8Array(await uf.file.arrayBuffer()),
      })
    }
  }

  return tasks
}

interface RunCallbacks {
  /** Reports OCR page progress for image/vector PDFs. */
  onOcrPage?: (page: number, total: number) => void
}

async function runTask(
  task: Task,
  { onOcrPage }: RunCallbacks = {}
): Promise<{ orders: Order[]; disputes: Dispute[]; errors: string[]; usedOcr?: boolean }> {
  const bytes = await task.getBytes()

  if (task.ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(bytes)
    const r = parseCSV(text, task.company, task.transporter)
    return { orders: r.orders, disputes: [], errors: r.errors }
  }

  if (task.ext === 'xlsx' || task.ext === 'xls') {
    const r = await parseExcel(bytes, task.company, task.transporter, task.fileType)
    return { orders: r.orders, disputes: r.disputes, errors: r.errors }
  }

  // PDF — first try the cheap text path.
  const r = await parsePDF(bytes, task.company, task.transporter)
  const noText = r.orders.length === 0 && r.errors.some((e) => e === PDF_NO_TEXT_ERROR)
  if (!noText) {
    return { orders: r.orders, disputes: r.disputes, errors: r.errors }
  }

  // No extractable text → OCR fallback (renders pages + Tesseract, all local).
  try {
    const text = await ocrPdf(bytes, {
      onPage: onOcrPage,
      // Stop as soon as we have id + date + a positive total AND we have seen the
      // authoritative "Transporteurs" table (which carries the real carrier +
      // shipping). This is typically page 2, so we avoid OCR'ing later pages.
      shouldStop: (acc) => {
        const probe = parsePdfTextContent(acc, task.company, task.transporter)
        const o = probe.orders[0]
        return Boolean(
          o && o.id && o.date && o.totalTTC > 0 && /Transporteurs?\s*\(/i.test(acc)
        )
      },
    })

    if (!text.trim()) {
      return { orders: [], disputes: [], errors: ['OCR : aucun texte reconnu.'], usedOcr: true }
    }

    const parsed = parsePdfTextContent(text, task.company, task.transporter)
    return {
      orders: parsed.orders,
      disputes: parsed.disputes,
      errors: parsed.orders.length === 0 ? [...parsed.errors, 'OCR : données non reconnues dans le texte.'] : parsed.errors,
      usedOcr: true,
    }
  } catch (err) {
    return {
      orders: [],
      disputes: [],
      errors: [`OCR échoué : ${err instanceof Error ? err.message : 'erreur inconnue'}`],
      usedOcr: true,
    }
  }
}

function resolvePeriod(orders: Order[]): string {
  if (orders.length === 0) return ''
  const dates = orders.map((o) => o.date).filter(Boolean).sort()
  if (!dates.length) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  return first === last ? first : `${first} — ${last}`
}

export interface LocalResult {
  data: ProcessedData
  warnings: string[]
}

/**
 * Process all uploaded files locally and return the merged report.
 * `onProgress` is called frequently so the caller can render a progress bar.
 */
export async function processFilesLocally(
  uploaded: UploadedFile[],
  onProgress: (p: ProgressInfo) => void
): Promise<LocalResult> {
  const tasks = await buildTasks(uploaded, onProgress)
  const total = tasks.length

  const allOrders: Order[] = []
  const allDisputes: Dispute[] = []
  const warnings: string[] = []

  try {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      onProgress({ phase: 'parsing', current: task.name, done: i, total })

      try {
        const result = await runTask(task, {
          onOcrPage: (page, pageTotal) =>
            onProgress({
              phase: 'ocr',
              current: `${task.name} — lecture OCR page ${page}/${pageTotal}`,
              done: i,
              total,
            }),
        })
        allOrders.push(...result.orders)
        allDisputes.push(...result.disputes)
        if (result.errors.length) {
          warnings.push(...result.errors.map((e) => `[${task.name}] ${e}`))
        }
      } catch (err) {
        warnings.push(`[${task.name}] ${err instanceof Error ? err.message : 'Erreur de traitement'}`)
      }

      // Repaint between files so the UI never appears frozen.
      await yieldToUI()
    }
  } finally {
    // Always release the OCR worker, even on error.
    await terminateOcr()
  }

  onProgress({ phase: 'finalizing', current: '', done: total, total })

  // Normalize, dedupe, link disputes, group, compute stats — all pure functions.
  const processedOrders = processOrders(allOrders)
  const processedDisputes = processDisputes(allDisputes, processedOrders)

  const groupMap = new Map<string, { orders: Order[]; disputes: Dispute[] }>()
  for (const order of processedOrders) {
    const key = `${order.company}:${order.transporter}`
    const entry = groupMap.get(key) ?? { orders: [], disputes: [] }
    entry.orders.push(order)
    groupMap.set(key, entry)
  }
  for (const dispute of processedDisputes) {
    const key = `${dispute.company}:${dispute.transporter}`
    const entry = groupMap.get(key) ?? { orders: [], disputes: [] }
    entry.disputes.push(dispute)
    groupMap.set(key, entry)
  }

  const reports: CompanyReport[] = Array.from(groupMap.entries()).map(([key, { orders, disputes }]) => {
    const [company, transporter] = key.split(':') as [Company, Transporter]
    return {
      company,
      transporter,
      period: resolvePeriod(orders),
      orders,
      disputes,
      stats: calculateStats(orders),
    }
  })

  const data: ProcessedData = {
    reports,
    globalStats: calculateStats(processedOrders),
    processedAt: new Date().toISOString(),
  }

  return { data, warnings }
}

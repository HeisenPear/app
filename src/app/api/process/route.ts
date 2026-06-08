import { NextRequest, NextResponse } from 'next/server'
import { parseCSV } from '@/lib/parsers/csv'
import { parseExcel } from '@/lib/parsers/excel'
import { parseZip } from '@/lib/parsers/zip'
import { parsePDF } from '@/lib/parsers/pdf'
import { calculateStats } from '@/lib/processors/stats'
import { processOrders } from '@/lib/processors/orders'
import { processDisputes } from '@/lib/processors/disputes'
import { saveBatch, isStorageConfigured } from '@/lib/storage/blob'
import { COMPANY_LABELS } from '@/lib/types'
import type { Order, Dispute, Company, Transporter, FileType, ProcessedData, CompanyReport, BatchSummary } from '@/lib/types'

// PDF/Excel parsing relies on Node.js APIs — force the Node runtime, not Edge.
export const runtime = 'nodejs'
export const maxDuration = 60

function detectFileExtension(filename: string): 'csv' | 'xlsx' | 'xls' | 'pdf' | 'zip' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'zip') return 'zip'
  return 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const allOrders: Order[] = []
    const allDisputes: Dispute[] = []
    const errors: string[] = []
    const rawSources: Array<{ name: string; type: string; buffer: Buffer }> = []

    for (const file of files) {
      const company = (formData.get(`company_${file.name}`) as Company) || 'duhalle'
      const fileType = (formData.get(`fileType_${file.name}`) as FileType) || 'commandes'
      const transporter = formData.get(`transporter_${file.name}`) as Transporter | null

      const ext = detectFileExtension(file.name)
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      rawSources.push({ name: file.name, type: file.type || 'application/octet-stream', buffer })

      try {
        if (ext === 'csv') {
          const content = buffer.toString('utf-8')
          const result = parseCSV(content, company, transporter || undefined)
          allOrders.push(...result.orders)
          errors.push(...result.errors)
        } else if (ext === 'xlsx' || ext === 'xls') {
          const result = await parseExcel(buffer, company, transporter || undefined, fileType)
          allOrders.push(...result.orders)
          allDisputes.push(...result.disputes)
          errors.push(...result.errors)
        } else if (ext === 'zip') {
          const result = await parseZip(buffer, company, transporter || undefined)
          allOrders.push(...result.orders)
          allDisputes.push(...result.disputes)
          errors.push(...result.errors)
        } else if (ext === 'pdf') {
          const result = await parsePDF(buffer, company, transporter || undefined)
          allOrders.push(...result.orders)
          allDisputes.push(...result.disputes)
          errors.push(...result.errors)
        } else {
          errors.push(`${file.name}: Unknown file format`)
        }
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Processing error'}`)
      }
    }

    // Process and normalize data
    const processedOrders = processOrders(allOrders)
    const processedDisputes = processDisputes(allDisputes, processedOrders)

    // Group by company + transporter
    const groupMap = new Map<string, { orders: Order[]; disputes: Dispute[] }>()

    for (const order of processedOrders) {
      const key = `${order.company}:${order.transporter}`
      if (!groupMap.has(key)) groupMap.set(key, { orders: [], disputes: [] })
      groupMap.get(key)!.orders.push(order)
    }

    for (const dispute of processedDisputes) {
      const key = `${dispute.company}:${dispute.transporter}`
      if (!groupMap.has(key)) groupMap.set(key, { orders: [], disputes: [] })
      groupMap.get(key)!.disputes.push(dispute)
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

    // Calculate global stats
    const globalStats = calculateStats(processedOrders)

    const processedData: ProcessedData = {
      reports,
      globalStats,
      processedAt: new Date().toISOString(),
    }

    // Optionally persist this run (raw files + report) to shared storage
    const persist = formData.get('persist') === 'true'
    let savedBatch: BatchSummary | null = null
    let persistError: string | undefined
    if (persist) {
      if (!isStorageConfigured()) {
        persistError =
          "Stockage partagé non configuré : créez un store Vercel Blob (variable BLOB_READ_WRITE_TOKEN) pour activer l'historique."
      } else {
        try {
          const label =
            (formData.get('label') as string | null)?.trim() ||
            defaultLabel(reports)
          savedBatch = await saveBatch({ label, data: processedData, sources: rawSources })
        } catch (err) {
          persistError = err instanceof Error ? err.message : 'Échec de la sauvegarde'
        }
      }
    }

    return NextResponse.json({
      ...processedData,
      errors,
      batch: savedBatch,
      persistError,
    })
  } catch (err) {
    console.error('Process error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function resolvePeriod(orders: Order[]): string {
  if (orders.length === 0) return ''
  const dates = orders.map(o => o.date).filter(Boolean).sort()
  if (dates.length === 0) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (first === last) return first
  return `${first} — ${last}`
}

/** Build a human-friendly default label from the processed reports. */
function defaultLabel(reports: CompanyReport[]): string {
  const companies = Array.from(new Set(reports.map((r) => COMPANY_LABELS[r.company])))
  const stamp = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const who = companies.length > 0 ? companies.join(' + ') : 'Import'
  return `${who} — ${stamp}`
}

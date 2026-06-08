import JSZip from 'jszip'
import type { Order, Dispute, Transporter, Company } from '../types'
import { parseCSV } from './csv'
import { parseExcel } from './excel'

export interface ParsedZipResult {
  orders: Order[]
  disputes: Dispute[]
  errors: string[]
  processedFiles: string[]
}

function detectFileType(filename: string): 'csv' | 'xlsx' | 'xls' | 'pdf' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  if (ext === 'pdf') return 'pdf'
  return 'unknown'
}

function isLitigesFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.includes('litig') || lower.includes('dispute') || lower.includes('reclamation')
}

function detectTransporterFromFilename(filename: string): Transporter | undefined {
  const lower = filename.toLowerCase()
  if (lower.includes('colissimo') || lower.includes('colis')) return 'colissimo'
  if (lower.includes('dpd')) return 'dpd'
  if (lower.includes('geodis') || lower.includes('geo')) return 'geodis'
  return undefined
}

export async function parseZip(
  buffer: Buffer,
  company: Company,
  defaultTransporter?: Transporter
): Promise<ParsedZipResult> {
  const errors: string[] = []
  const allOrders: Order[] = []
  const allDisputes: Dispute[] = []
  const processedFiles: string[] = []

  const zip = await JSZip.loadAsync(buffer)

  const fileEntries = Object.entries(zip.files).filter(([, entry]) => !entry.dir)

  for (const [filename, entry] of fileEntries) {
    const fileType = detectFileType(filename)
    const isLitiges = isLitigesFile(filename)
    const transporter = detectTransporterFromFilename(filename) || defaultTransporter

    try {
      if (fileType === 'csv') {
        const content = await entry.async('string')
        const result = parseCSV(content, company, transporter)
        allOrders.push(...result.orders)
        if (result.errors.length > 0) {
          errors.push(`[${filename}]: ${result.errors.join(', ')}`)
        }
        processedFiles.push(filename)
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const arrayBuffer = await entry.async('arraybuffer')
        const buffer = Buffer.from(arrayBuffer)
        const result = await parseExcel(
          buffer,
          company,
          transporter,
          isLitiges ? 'litiges' : 'commandes'
        )
        allOrders.push(...result.orders)
        allDisputes.push(...result.disputes)
        if (result.errors.length > 0) {
          errors.push(`[${filename}]: ${result.errors.join(', ')}`)
        }
        processedFiles.push(filename)
      } else if (fileType === 'pdf') {
        errors.push(`[${filename}]: PDF parsing not supported in batch processing`)
      } else {
        // Skip unknown files
      }
    } catch (err) {
      errors.push(
        `[${filename}]: ${err instanceof Error ? err.message : 'Processing error'}`
      )
    }
  }

  return { orders: allOrders, disputes: allDisputes, errors, processedFiles }
}

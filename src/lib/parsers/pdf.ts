import { PDFParse } from 'pdf-parse'
import type { Order, Dispute, Transporter, Company } from '../types'

export interface ParsedPDFResult {
  orders: Order[]
  disputes: Dispute[]
  errors: string[]
  format: PdfFormat
}

export type PdfFormat = 'duhalle-oxatis' | 'jocondienne' | 'unknown'

const FR_MONTHS: Record<string, string> = {
  janvier: '01',
  février: '02',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  août: '08',
  aout: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  décembre: '12',
  decembre: '12',
}

/**
 * Parse a French monetary string ("6,90 €", "1 276,50", "13.20") into a number.
 * Handles thousands separators (space or dot) and comma decimals.
 */
export function parseFrAmount(input: string | null | undefined): number {
  if (input == null) return 0
  const match = String(input).match(/-?[0-9][0-9\s.,]*/)
  if (!match) return 0
  const cleaned = match[0]
    .replace(/\s/g, '')
    // Drop dot thousands separators (e.g. "1.276,50"), keep comma decimal
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  const value = parseFloat(cleaned)
  return Number.isFinite(value) ? value : 0
}

/** "31 mai 2026" -> "2026-05-31" */
export function frenchDateToISO(input: string | null | undefined): string {
  if (!input) return ''
  const m = String(input)
    .trim()
    .match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/)
  if (!m) return String(input).trim()
  const day = m[1].padStart(2, '0')
  const month = FR_MONTHS[m[2].toLowerCase()]
  const year = m[3]
  if (!month) return String(input).trim()
  return `${year}-${month}-${day}`
}

/** "08/06/2026" -> "2026-06-08" */
export function ddmmyyyyToISO(input: string | null | undefined): string {
  if (!input) return ''
  const m = String(input)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return String(input).trim()
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/**
 * Extract concatenated plain text from a PDF buffer using pdfjs (via pdf-parse).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return result.text || ''
  } finally {
    await parser.destroy()
  }
}

/**
 * Identify which invoice layout a PDF uses based on its text content.
 */
export function detectPdfFormat(text: string): PdfFormat {
  if (/Commande #\d+/.test(text) && /Montant Total TTC/i.test(text)) {
    return 'duhalle-oxatis'
  }
  if (/Réf\.?\s*de\s*commande/i.test(text) || /Frais de livraison/i.test(text) || /La Jocondienne/i.test(text)) {
    return 'jocondienne'
  }
  return 'unknown'
}

function detectTransporterFromText(text: string): Transporter | undefined {
  const lower = text.toLowerCase()
  // Predict is a DPD France delivery service
  if (lower.includes('predict') || lower.includes('dpd')) return 'dpd'
  if (lower.includes('geodis')) return 'geodis'
  if (lower.includes('colissimo')) return 'colissimo'
  return undefined
}

/**
 * Parse Duhallé Boutique invoices (Oxatis export — many invoices per PDF).
 * Each invoice block starts with "Commande #<number>".
 */
export function parseDuhalleOxatis(
  text: string,
  company: Company,
  transporter?: Transporter
): { orders: Order[]; errors: string[] } {
  const orders: Order[] = []
  const errors: string[] = []

  const blocks = text.split(/Commande #/).slice(1)
  blocks.forEach((block, idx) => {
    try {
      const idMatch = block.match(/^(\d+)/)
      if (!idMatch) return
      const id = idMatch[1]

      const dateMatch = block.match(/^\d+\s*\t?\s*(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/)
      const date = dateMatch ? frenchDateToISO(dateMatch[1]) : ''

      const modeMatch = block.match(/Mode de livraison\s*[\r\n]+([^\r\n]+)/)
      const deliveryMode = modeMatch
        ? modeMatch[1].trim()
        : 'Colissimo Flexibilité domicile - Livraison à Domicile - France métropolitaine'

      const totalMatch = block.match(/Montant Total TTC\s*([0-9][0-9\s.,]*)\s*€/)
      const totalTTC = totalMatch ? parseFrAmount(totalMatch[1]) : 0

      // Shipping cost: located between "Frais de port TTC" and "Montant Total TTC"
      let shippingCost = 0
      const fpIdx = block.indexOf('Frais de port TTC')
      const mtIdx = block.indexOf('Montant Total TTC')
      if (fpIdx >= 0 && mtIdx > fpIdx) {
        const segment = block.slice(fpIdx + 'Frais de port TTC'.length, mtIdx)
        if (/gratuit|offert/i.test(segment)) {
          shippingCost = 0
        } else {
          const amounts = [...segment.matchAll(/([0-9][0-9\s.,]*)\s*€/g)].map((m) =>
            parseFrAmount(m[1])
          )
          shippingCost = amounts.length ? amounts[amounts.length - 1] : 0
        }
      }

      orders.push({
        id: id.trim(),
        date,
        company,
        transporter: transporter || 'colissimo',
        totalTTC,
        shippingCost,
        deliveryMode,
      })
    } catch (err) {
      errors.push(`Bloc commande ${idx + 1} : ${err instanceof Error ? err.message : 'erreur de parsing'}`)
    }
  })

  return { orders, errors }
}

/**
 * Parse La Jocondienne invoices. Each invoice contains a data line:
 *   "#FA004033 08/06/2026 KGDRIKLVN 08/06/2026"
 * mapping to: invoice number, invoice date, order reference, order date.
 */
export function parseJocondienne(
  text: string,
  company: Company,
  transporter?: Transporter
): { orders: Order[]; errors: string[] } {
  const orders: Order[] = []
  const errors: string[] = []

  const anchorRe = /#(FA\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(\d{2}\/\d{2}\/\d{4})/g
  const anchors: Array<{ idx: number; invoice: string; orderRef: string; orderDate: string }> = []
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(text)) !== null) {
    anchors.push({ idx: m.index, invoice: m[1], orderRef: m[3], orderDate: m[4] })
  }

  anchors.forEach((anchor, i) => {
    try {
      const end = i + 1 < anchors.length ? anchors[i + 1].idx : text.length
      const block = text.slice(anchor.idx, end)

      const shipMatch = block.match(/Frais de livraison\s+([0-9][0-9\s.,]*)\s*€/i)
      const shippingCost = shipMatch ? parseFrAmount(shipMatch[1]) : 0

      // The final standalone "Total X €" line is the TTC amount
      const totalMatches = [...block.matchAll(/Total\s+([0-9][0-9\s.,]*)\s*€/gi)]
      const totalTTC = totalMatches.length
        ? parseFrAmount(totalMatches[totalMatches.length - 1][1])
        : 0

      const modeMatch = block.match(/Transporteur\s+([^\r\n]+)/i)
      const deliveryMode = modeMatch ? modeMatch[1].trim() : 'Livraison à domicile'

      const blockTransporter = transporter || detectTransporterFromText(block) || 'dpd'

      orders.push({
        // Order reference links disputes — use it as the order id
        id: anchor.orderRef.trim(),
        date: ddmmyyyyToISO(anchor.orderDate),
        company,
        transporter: blockTransporter,
        totalTTC,
        shippingCost,
        deliveryMode,
      })
    } catch (err) {
      errors.push(`Facture ${anchor.invoice} : ${err instanceof Error ? err.message : 'erreur de parsing'}`)
    }
  })

  return { orders, errors }
}

/**
 * Top-level PDF parser: extracts text, detects the layout and dispatches to the
 * matching invoice parser. The company hint helps select the layout when the
 * content is ambiguous.
 */
export async function parsePDF(
  buffer: Buffer,
  company: Company,
  transporter?: Transporter
): Promise<ParsedPDFResult> {
  const errors: string[] = []
  let text = ''
  try {
    text = await extractPdfText(buffer)
  } catch (err) {
    return {
      orders: [],
      disputes: [],
      errors: [`Extraction du texte PDF échouée : ${err instanceof Error ? err.message : 'erreur inconnue'}`],
      format: 'unknown',
    }
  }

  if (!text.trim()) {
    return {
      orders: [],
      disputes: [],
      errors: ['Le PDF ne contient aucun texte extractible (probablement un scan/image).'],
      format: 'unknown',
    }
  }

  let format = detectPdfFormat(text)
  // Fall back to the company hint when the layout cannot be auto-detected
  if (format === 'unknown') {
    format = company === 'jocondienne' ? 'jocondienne' : 'duhalle-oxatis'
  }

  if (format === 'duhalle-oxatis') {
    const { orders, errors: parseErrors } = parseDuhalleOxatis(text, company, transporter)
    return { orders, disputes: [], errors: [...errors, ...parseErrors], format }
  }

  const { orders, errors: parseErrors } = parseJocondienne(text, company, transporter)
  return { orders, disputes: [], errors: [...errors, ...parseErrors], format }
}

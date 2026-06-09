import { extractText, getDocumentProxy } from 'unpdf'
import type { Order, Dispute, Transporter, Company } from '../types'

export interface ParsedPDFResult {
  orders: Order[]
  disputes: Dispute[]
  errors: string[]
  format: PdfFormat
}

export type PdfFormat = 'duhalle-oxatis' | 'jocondienne' | 'prestashop-order' | 'unknown'

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
    // PDF text extraction sometimes drops the decimal comma, leaving a bare
    // space instead: "6,90" → "6 90", "9,27" → "9 27".
    // A space followed by exactly 2 digits (not part of a 3-digit group) is
    // treated as a lost decimal separator: "6 90" → "6.90", "9 27" → "9.27".
    .replace(/(\d) (\d{2})(?!\d)/g, '$1.$2')
    // A space followed by 3 digits is a real thousands separator: "1 276" → "1276"
    .replace(/(\d) (\d{3})/g, '$1$2')
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
 * Extract concatenated plain text from a PDF buffer.
 *
 * Uses `unpdf`, which ships a serverless-compatible build of pdf.js. Unlike the
 * default pdf.js distribution it does not rely on browser globals such as
 * `DOMMatrix`, so it runs reliably inside Vercel's Node.js serverless functions.
 * The returned text merges all pages and joins text items with spaces (no
 * guaranteed newlines), so the invoice parsers below must not depend on line
 * breaks.
 */
export async function extractPdfText(buffer: Buffer | Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text || ''
}

/**
 * Identify which invoice layout a PDF uses based on its text content.
 *
 * The two companies issue structurally different invoices, so the layout
 * doubles as a reliable company signal:
 *   - Duhallé Boutique → Oxatis invoices ("Commande #…", "Montant Total TTC").
 *   - La Jocondienne   → "#FA…" invoices ("Réf. de commande", "Frais de livraison").
 */
export function detectPdfFormat(text: string): PdfFormat {
  const hasCommande = /Commande\s*#?\s*\d+/i.test(text)

  // PrestaShop order-detail page (text is rasterized as vectors → reached via
  // OCR). Distinctive: an order number plus shipping/carrier tables, but NOT
  // the Oxatis "Montant Total TTC" wording.
  const prestashopMarkers =
    /Frais d['’]exp[ée]dition/i.test(text) ||
    /Total frais de port/i.test(text) ||
    /Bon de livraison/i.test(text) ||
    /Transporteurs?\s*\(\s*\d/i.test(text) ||
    /point\s+retrait/i.test(text)
  if (hasCommande && prestashopMarkers && !/Montant Total TTC/i.test(text)) {
    return 'prestashop-order'
  }

  // Oxatis (Duhallé) multi-invoice export
  if (/Commande #\d+/.test(text) && /Montant Total TTC/i.test(text)) {
    return 'duhalle-oxatis'
  }

  // La Jocondienne single invoice
  const isJocondienne =
    /La Jocondienne/i.test(text) ||
    /#FA\d+/.test(text) ||
    /Réf\.?\s*de\s*commande/i.test(text) ||
    /Frais de livraison/i.test(text)

  const isDuhalle =
    /duhalle/i.test(text) ||
    /oxatis/i.test(text)

  if (isJocondienne) return 'jocondienne'
  if (isDuhalle) return 'duhalle-oxatis'
  return 'unknown'
}

/**
 * Map a detected invoice layout to the company that issues it.
 *
 * The two companies use different e-commerce platforms, so the PDF layout is a
 * reliable company signal:
 *   - Duhallé Boutique → Oxatis multi-invoice exports (duhalle-oxatis)
 *   - La Jocondienne   → PrestaShop order pages (prestashop-order) and the
 *                        older single "#FA…" invoices (jocondienne)
 */
export function companyFromFormat(format: PdfFormat): Company | undefined {
  if (format === 'duhalle-oxatis') return 'duhalle'
  if (format === 'jocondienne') return 'jocondienne'
  if (format === 'prestashop-order') return 'jocondienne'
  return undefined
}

/** Infer the company from explicit name markers anywhere in the text. */
export function detectCompanyFromText(text: string): Company | undefined {
  if (/jocondienne/i.test(text)) return 'jocondienne'
  if (/duhall/i.test(text)) return 'duhalle'
  return undefined
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

      const dateMatch = block.match(/^\d+\s+(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/)
      const date = dateMatch ? frenchDateToISO(dateMatch[1]) : ''

      // The delivery mode sits between "Mode de livraison" and "Mode de paiement"
      const modeMatch = block.match(/Mode de livraison\s+(.+?)\s+Mode de paiement/)
      const deliveryMode = (modeMatch
        ? modeMatch[1].trim()
        : 'Colissimo Flexibilité domicile - Livraison à Domicile - France métropolitaine'
      )
        // Drop the "Frais de port offerts" suffix that can trail the mode
        .replace(/\s*Frais de port offerts\s*$/i, '')
        .trim()

      const totalMatch = block.match(/Montant Total TTC\s*([0-9][0-9\s.,]*)\s*€/)
      const totalTTC = totalMatch ? parseFrAmount(totalMatch[1]) : 0

      // Shipping cost: located between "Frais de port TTC" and "Montant Total TTC".
      // Take the FIRST amount — subsequent amounts in that segment are breakdowns
      // (e.g. "dont TVA 1,15 €") that must not be mistaken for the total port cost.
      // Use [0-9 .,]* (literal space) not \s to avoid spanning across newlines and
      // accidentally merging adjacent numbers from different lines.
      let shippingCost = 0
      const fpIdx = block.indexOf('Frais de port TTC')
      const mtIdx = block.indexOf('Montant Total TTC')
      if (fpIdx >= 0 && mtIdx > fpIdx) {
        const segment = block.slice(fpIdx + 'Frais de port TTC'.length, mtIdx)
        if (/gratuit|offert/i.test(segment)) {
          shippingCost = 0
        } else {
          const amounts = [...segment.matchAll(/([0-9][0-9 .,]*)\s*€/g)].map((m) =>
            parseFrAmount(m[1])
          )
          shippingCost = amounts.length ? amounts[0] : 0
        }
      }

      // The carrier is identified by the delivery mode wording (the content is
      // the source of truth); fall back to the caller hint, then Colissimo.
      const orderTransporter =
        detectTransporterFromText(deliveryMode) || transporter || 'colissimo'

      orders.push({
        id: id.trim(),
        date,
        company,
        transporter: orderTransporter,
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

      const shipMatch = block.match(/Frais de livraison\s+([0-9][0-9 .,]*)\s*€/i)
      const shippingCost = shipMatch ? parseFrAmount(shipMatch[1]) : 0

      // The final standalone "Total X €" line is the TTC amount
      const totalMatches = [...block.matchAll(/Total\s+([0-9][0-9 .,]*)\s*€/gi)]
      const totalTTC = totalMatches.length
        ? parseFrAmount(totalMatches[totalMatches.length - 1][1])
        : 0

      const modeMatch = block.match(/Transporteur\s+(.+?)(?:\s+Powered by|\s+La Jocondienne|$)/i)
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

/** First monetary amount captured by `re` (group 1), or null if no match. */
function firstAmount(text: string, re: RegExp): number | null {
  const m = text.match(re)
  return m ? parseFrAmount(m[1]) : null
}

/**
 * Parse a PrestaShop order-detail page (one order per PDF, reached via OCR
 * because the text is rasterized as vector outlines).
 *
 * Layout cues (see the rendered sample):
 *   "Commande #3812 MTSVMGLMO"      → order number + reference code
 *   "01/05/2026 09:50:03"            → order date (first date on the page)
 *   "Produits 3,55 € Livraison 5,26 € Total 8,81 €"  → totals line
 *   "Frais d'expédition 5,26 €"      → shipping (Transporteurs table)
 *   "Total frais de port (TTC) : 5,26 €"  → shipping (carrier slip)
 *   "Colissimo Points de retrait"    → carrier
 */
export function parsePrestashopOrder(
  text: string,
  company: Company,
  transporter?: Transporter
): { orders: Order[]; errors: string[] } {
  const orders: Order[] = []
  const errors: string[] = []

  try {
    const idMatch = text.match(/Commande\s*#?\s*(\d+)/i)
    if (!idMatch) {
      return { orders, errors: ['Format PrestaShop non reconnu (numéro de commande introuvable)'] }
    }
    const id = idMatch[1]

    // First date on the page is the order date ("01/05/2026 ...")
    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : ''

    // Shipping cost detection — priority order from most specific to least.
    // Use [0-9 .,]* (literal space, not \s) in capture groups to avoid crossing
    // newlines and merging adjacent numbers from different columns.
    //
    // The carrier-name regex is intentionally LAST because it grabs the FIRST
    // € amount after the carrier name, which could be a product total when the
    // OCR merges multiple columns onto one pseudo-line.
    const shippingCost =
      // 1. "Total frais de port (TTC)" — most explicit
      firstAmount(text, /total\s+frais\s+de\s+port[^€\n]{0,40}?([\d][\d .,]*)\s*€/i) ??
      // 2. "Frais d'expédition" / "Frais d'expedition"
      firstAmount(text, /frais\s+d['']exp[ée]dition[^€\n]{0,20}?([\d][\d .,]*)\s*€/i) ??
      // 3. Generic "frais de port"
      firstAmount(text, /frais\s+de\s+port[^€\n]{0,40}?([\d][\d .,]*)\s*€/i) ??
      // 4. Weight line: "0,100 kg 5,26 €" — amount immediately after weight unit
      firstAmount(text, /\bkg[^€\n]{0,30}?([\d][\d .,]*)\s*€/i) ??
      // 5. Summary line: "Livraison 5,26 €"
      firstAmount(text, /livraison\s+([\d][\d .,]*)\s*€/i) ??
      // 6. Carrier name line (last resort — may pick wrong amount if other €
      //    values appear earlier on the same OCR line)
      firstAmount(
        text,
        /(?:colissimo|dpd|predict|geodis|chronopost|mondial\s*relay)[^€\n]{0,80}?([\d][\d .,]*)\s*€/i
      ) ??
      0

    // Total TTC — the Documents table keeps "Facture #FA… 8,81 €" on one row.
    // Fallback to the largest amount on the page (the order total is the max).
    let totalTTC: number | null =
      firstAmount(text, /facture\s+#?\s*fa\d+\s+([\d][\d .,]*)\s*€/i) ??
      firstAmount(text, /bon\s+de\s+livraison\s+#?\s*li\d+\s+([\d][\d .,]*)\s*€/i)
    if (totalTTC == null) {
      const amounts = [...text.matchAll(/([\d][\d .,]*)\s*€/g)]
        .map((m) => parseFrAmount(m[1]))
        .filter((n) => n > 0)
      totalTTC = amounts.length ? Math.max(...amounts) : 0
    }

    // Carrier from content (auto), falling back to the caller hint.
    const orderTransporter = detectTransporterFromText(text) || transporter || 'colissimo'

    // Best-effort human-readable delivery mode.
    const modeMatch = text.match(
      /(Colissimo[^\d€\n]{0,30}|Chronopost[^\d€\n]{0,30}|DPD[^\d€\n]{0,30}|GEODIS[^\d€\n]{0,30}|Mondial Relay[^\d€\n]{0,30})/i
    )
    const deliveryMode = modeMatch
      ? modeMatch[1].trim()
      : TRANSPORTER_DEFAULT_MODE[orderTransporter]

    orders.push({
      id: id.trim(),
      date,
      company,
      transporter: orderTransporter,
      totalTTC,
      shippingCost,
      deliveryMode,
    })
  } catch (err) {
    errors.push(`PrestaShop: ${err instanceof Error ? err.message : 'erreur de parsing'}`)
  }

  return { orders, errors }
}

const TRANSPORTER_DEFAULT_MODE: Record<Transporter, string> = {
  colissimo: 'Colissimo',
  dpd: 'DPD',
  geodis: 'GEODIS',
}

/**
 * Detect the layout from already-extracted text and dispatch to the matching
 * parser. Shared by both the text path (parsePDF) and the OCR path.
 */
export function parsePdfTextContent(
  text: string,
  company: Company,
  transporter?: Transporter
): ParsedPDFResult {
  let format = detectPdfFormat(text)
  if (format === 'unknown') {
    format = company === 'jocondienne' ? 'jocondienne' : 'duhalle-oxatis'
  }

  // Trust the content for the company when it carries an explicit signal.
  const resolvedCompany =
    companyFromFormat(format) ?? detectCompanyFromText(text) ?? company

  if (format === 'prestashop-order') {
    const { orders, errors } = parsePrestashopOrder(text, resolvedCompany, transporter)
    return { orders, disputes: [], errors, format }
  }
  if (format === 'duhalle-oxatis') {
    const { orders, errors } = parseDuhalleOxatis(text, resolvedCompany, transporter)
    return { orders, disputes: [], errors, format }
  }
  const { orders, errors } = parseJocondienne(text, resolvedCompany, transporter)
  return { orders, disputes: [], errors, format }
}

/** Sentinel error so callers (OCR fallback) can detect a no-text PDF. */
export const PDF_NO_TEXT_ERROR = 'Le PDF ne contient aucun texte extractible (probablement une image / texte vectorisé).'

/**
 * Top-level PDF parser: extracts text, detects the layout and dispatches to the
 * matching invoice parser. When the PDF has no extractable text, it returns the
 * PDF_NO_TEXT_ERROR sentinel so the client can fall back to OCR.
 */
export async function parsePDF(
  buffer: Buffer | Uint8Array,
  company: Company,
  transporter?: Transporter
): Promise<ParsedPDFResult> {
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
    return { orders: [], disputes: [], errors: [PDF_NO_TEXT_ERROR], format: 'unknown' }
  }

  return parsePdfTextContent(text, company, transporter)
}

import { extractText, getDocumentProxy } from 'unpdf'
import type { Order, Dispute, Transporter, Company } from '../types'

export interface ParsedPDFResult {
  orders: Order[]
  disputes: Dispute[]
  errors: string[]
  format: PdfFormat
}

export type PdfFormat = 'duhalle-oxatis' | 'jocondienne' | 'prestashop-order' | 'amazon' | 'unknown'

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
  // Amazon Marketplace packing slips (vectorised → reached via OCR). One order
  // per page, many pages per file. Checked FIRST because the seller name
  // "La Jocondienne" also appears on them and would otherwise misroute the file
  // to the Jocondienne parser. Markers are highly distinctive to Amazon.
  const isAmazon =
    /sellercentral\.amazon/i.test(text) ||
    /Amazon\s*Marketplace/i.test(text) ||
    (/amazon/i.test(text) &&
      (/Num[ée]ro de la commande\s*:/i.test(text) ||
        /Nom du vendeur/i.test(text) ||
        /Total de l['']exp[ée]dition/i.test(text)))
  if (isAmazon) return 'amazon'

  const hasCommande = /Commande\s*#?\s*\d+/i.test(text)

  // PrestaShop order-detail page (text is rasterized as vectors → reached via
  // OCR). Distinctive: an order number plus shipping/carrier tables, but NOT
  // the Oxatis "Montant Total TTC" wording. Markers are kept broad (and tolerant
  // of OCR noise) so an order is never misrouted to another parser and silently
  // dropped.
  const prestashopMarkers =
    /Frais d['']exp[ée]di/i.test(text) ||
    /Total frais de port/i.test(text) ||
    /Bon de livraison/i.test(text) ||
    /Transporteurs?\s*\(/i.test(text) ||
    /Transporteur GLS/i.test(text) ||
    /Num[ée]ro de suivi/i.test(text) ||
    /Points? de retrait/i.test(text) ||
    /relais\s*pickup/i.test(text) ||
    /click\s*&?\s*collect/i.test(text)
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
  if (format === 'amazon') return 'amazon'
  return undefined
}

/** Infer the company from explicit name markers anywhere in the text. */
export function detectCompanyFromText(text: string): Company | undefined {
  // Amazon first: its slips also carry the seller name ("La Jocondienne"), so
  // the marketplace signal must take precedence.
  if (/sellercentral\.amazon/i.test(text) || /Amazon\s*Marketplace/i.test(text)) return 'amazon'
  if (/jocondienne/i.test(text)) return 'jocondienne'
  if (/duhall/i.test(text)) return 'duhalle'
  return undefined
}

/**
 * Map a *carrier name* (as printed on an invoice's carrier line) to one of our
 * transporter buckets. This is keyword-mapped from a SPECIFIC string — the
 * carrier cell of the order's Transporteurs table — never from a whole page,
 * because PrestaShop pages always carry advertising modules ("Transporteur GLS",
 * "Associer cette commande à Colissimo") that would otherwise win.
 *
 * Carrier wordings seen in the wild:
 *   "Colissimo Points de retrait"          → colissimo
 *   "Livraison en relais Pickup"           → dpd  (Pickup is DPD France)
 *   "GEODIS - livraison sur rendez-vous"   → geodis
 *   "Click & Collect"                      → retrait (in-store pickup, free)
 */
function carrierFromName(name: string): Transporter | undefined {
  const s = name.toLowerCase()
  // In-store pickup / Click & Collect — no real carrier, shipping is offered.
  // Allow up to 5 chars between "click" and "collect" to tolerate OCR noise
  // ("Click & Collect" / "Click a Collect" / "Cllck & Collect").
  if (/click.{0,5}collect|retrait\s+(en\s+)?(magasin|boutique)/.test(s)) return 'retrait'
  // DPD France services: "relais Pickup", "Predict", plain "DPD".
  if (/relais.{0,5}pickup|\bpickup\b|predict|\bdpd\b/.test(s)) return 'dpd'
  if (/geodis/.test(s)) return 'geodis'
  if (/colissimo|la\s*poste|so\s*colissimo/.test(s)) return 'colissimo'
  return undefined
}

/** Backward-compatible alias used by the Duhallé / old-Jocondienne parsers. */
function detectTransporterFromText(text: string): Transporter | undefined {
  return carrierFromName(text)
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

/** Largest strict-decimal "€" amount on the page (last-resort total). */
function maxStrictAmount(text: string): number {
  const amounts = [...text.matchAll(/(\d[\d ]*[,.]\d{2})\s*€/g)]
    .map((m) => parseFrAmount(m[1]))
    .filter((n) => n > 0)
  return amounts.length ? Math.max(...amounts) : 0
}

/** Sum group-1 of every match of `re` (global). Returns null if none matched. */
function sumAmounts(text: string, re: RegExp): number | null {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const values = [...text.matchAll(g)].map((m) => parseFrAmount(m[1]))
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100
}

/**
 * Parse Amazon Marketplace packing slips (reached via OCR — the pages are
 * rasterised). ONE order per page, MANY pages per file, so the concatenated OCR
 * text holds many orders; we split on the "Numéro de la commande" header.
 *
 * Business rules (per the client):
 *   • Prices are already TTC — take them as printed, no VAT maths.
 *   • Shipping = the LEFT column of the "Total de l'expédition" row (the amount
 *     charged). The RIGHT column ("TVA comprise") is the VAT already included in
 *     it and must be ignored.
 *   • The only carrier on Amazon is DPD.
 *
 * Layout (one page):
 *   "Numéro de la commande : 407-3058911-3981121"
 *   "Date de commande : lun. 1 juin 2026"
 *   "Sous-total de l'article   6,49 €  1,08 €"
 *   "Total de l'expédition     9,64 €  1,61 €"   ← 9,64 = shipping (left column)
 *   "Total de l'article       16,13 €  2,69 €"
 *   "Total: 16,13 €"                              ← order total TTC
 */
export function parseAmazonOrder(
  text: string,
  company: Company
): { orders: Order[]; errors: string[] } {
  const orders: Order[] = []
  const errors: string[] = []

  // Split into per-order blocks on the order-number header.
  const blocks = text.split(/Num[ée]ro de la commande\s*:/i).slice(1)

  blocks.forEach((block, idx) => {
    try {
      // Amazon order id: "407-3058911-3981121"
      const idMatch = block.match(/(\d{3}-\d{7}-\d{7})/)
      if (!idMatch) return
      const id = idMatch[1]

      // Order date: "Date de commande : lun. 1 juin 2026" (day-of-week optional).
      // Anchor on the label, skip the non-numeric weekday, capture "1 juin 2026".
      const dateMatch =
        block.match(
          /Date de commande[^\d]{0,40}(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/i
        ) || block.match(/(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/)
      const date = dateMatch ? frenchDateToISO(dateMatch[1]) : ''

      // Article subtotal (left column). Summed in case of a multi-shipment order.
      const subTotal = sumAmounts(
        block,
        /Sous-?total de l['']article\s+(\d[\d ]*[,.]\d{2})\s*€/i
      )

      // Shipping = LEFT column of EVERY "Total de l'expédition" row, summed.
      // The right column ("TVA comprise") is ignored by capturing only the first
      // amount after each label. Some Amazon orders split into several shipments,
      // each with its own expédition line — the order's shipping is their sum.
      let shippingCost = sumAmounts(
        block,
        /Total de l['']exp[ée]dition\s+(\d[\d ]*[,.]\d{2})\s*€/i
      )

      // Order total TTC — the standalone "Total: 16,13 €" line (grand total).
      // Fallbacks handle OCR loss and multi-shipment slips (sum of article rows).
      const totalTTC =
        firstAmount(block, /Total\s*[:.]\s*(\d[\d ]*[,.]\d{2})\s*€/i) ??
        sumAmounts(block, /Total de l['']article\s+(\d[\d ]*[,.]\d{2})\s*€/i) ??
        (subTotal != null && shippingCost != null ? subTotal + shippingCost : null) ??
        maxStrictAmount(block)

      // Fallback for shipping when the label rows were garbled by OCR:
      // total − article subtotal (Amazon always shows Total = article + port).
      if (shippingCost == null) {
        shippingCost =
          subTotal != null && totalTTC > 0
            ? Math.max(0, Math.round((totalTTC - subTotal) * 100) / 100)
            : 0
      }

      // Amazon "Service de livraison : Standard" → human-readable mode.
      const modeMatch = block.match(/Service de livraison\s*:?\s*([A-Za-zÀ-ÿ]+)/i)
      const deliveryMode = modeMatch ? `Amazon ${modeMatch[1].trim()}` : 'Amazon DPD'

      // Address signature — a tie-breaker only. Two records that share an order
      // id but ship to a different postal code are kept as distinct orders
      // downstream, because the id was almost certainly mis-read by OCR on one of
      // them. We use the delivery postal code alone: it is OCR-reliable, whereas
      // the buyer-name text bleeds into adjacent labels ("… Nom du vendeur")
      // and would produce false mismatches. `\b\d{5}\b` picks the postal code
      // without matching the 3-/7-digit groups of the order number.
      const postal = (block.match(/\b\d{5}\b/) || [''])[0]
      const shipAddress = postal || undefined

      orders.push({
        id: id.trim(),
        date,
        company,
        // The only carrier on Amazon is DPD.
        transporter: 'dpd',
        totalTTC,
        shippingCost,
        deliveryMode,
        shipAddress,
      })
    } catch (err) {
      errors.push(`Commande Amazon ${idx + 1} : ${err instanceof Error ? err.message : 'erreur de parsing'}`)
    }
  })

  return { orders, errors }
}

/**
 * Parse a PrestaShop order-detail page (one order per PDF, reached via OCR
 * because the text is rasterized as vector outlines).
 *
 * DESIGN — one authoritative line per field (no "read the whole page and guess").
 * Each value is taken from the single table row that semantically holds it, so
 * the result is deterministic and immune to the advertising modules PrestaShop
 * prints on every order ("Transporteur GLS", "Associer à Colissimo", …).
 *
 *   • Carrier  → the "Transporteurs" table data row
 *                "01/05/2026  Colissimo Points de retrait  0.100 Kg  5,26 €  …"
 *                The carrier cell (between the row date and the weight) is the
 *                ONLY reliable carrier signal; the page elsewhere advertises GLS
 *                and Colissimo regardless of who actually shipped.
 *   • Shipping → the order summary "Livraison" amount, which keeps its decimal
 *                comma across OCR even when the Transporteurs row mangles it
 *                ("7,41 €" → "TA1E"). Handles both summary layouts (vertical
 *                "Livraison\n7,41 €" and horizontal "Produits Livraison Total\n
 *                56,65 € 9,27 €").
 *   • Total    → the "Documents" table "Facture #FA… 8,81 €" row, whose amount
 *                column keeps the comma — unlike the boxed "Total" header cells
 *                that OCR routinely drops (producing "881" for "8,81").
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

    // First date on the page is the order date ("01/05/2026 ...").
    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : ''

    // ---- Carrier: the single "Transporteurs" table data row (authoritative) --
    // Restrict the search to a window right after the "Transporteurs (n)" heading
    // so the later "Transporteur GLS" / "Associer à Colissimo" modules can never
    // interfere.
    let carrierName = ''
    let orderTransporter: Transporter | undefined
    const tIdx = text.search(/Transporteurs?\s*\(/i)
    if (tIdx >= 0) {
      const win = text.slice(tIdx, tIdx + 400)
      // Row: <date>  <carrier name>  <weight>,<decimals> Kg  <frais>  …
      // Use `.+?` (any char, lazy) instead of a character-class so OCR typos
      // (digit inserted into a word, etc.) don't break the match.
      const row = win.match(
        /\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+\d+[.,]\d+\s*Kg/i
      )
      if (row) carrierName = row[1].trim()
      // Map the cell first; if that failed, scan the (module-free) window.
      orderTransporter = carrierFromName(carrierName) || carrierFromName(win)

      // Also read the freight amount directly from the Transporteurs row —
      // it is the most specific source and works even when the summary is absent.
      // Stored for use as a tiebreaker below.
      // Pattern: <weight> Kg <optional spaces/date> <amount> €
    }
    orderTransporter = orderTransporter || transporter || 'colissimo'

    // ---- Shipping cost ---------------------------------------------------
    // Priority:
    //  1. Explicit free signals: retrait or "Livraison … gratuit/offert"
    //  2. Horizontal summary: "Produits Livraison [Total]\n<p> € <s> €"
    //  3. Vertical summary:   "Livraison\n<amount> €" (exact or 1 blank line)
    //  4. Carrier slip:       "Total frais de port (TTC) … <amount> €"
    //  5. Transporteurs row:  "… Kg <amount> €" — last resort; OCR sometimes
    //     mangles the decimal (e.g. "7,41" → "TA1E"), so the strict-decimal
    //     pattern rejects artefacts and correctly returns 0 for free shipping.

    // Signal from the Transporteurs row itself (strict decimal required).
    const kgRowAmount = firstAmount(text, /\bKg\s+(\d[\d ]*[,.]\d{2})\s*€/i)

    let shippingCost: number
    if (orderTransporter === 'retrait' || kgRowAmount === 0) {
      // Explicit free shipping: Click & Collect, or Transporteurs row = 0,00 €.
      shippingCost = 0
    } else if (/Livraison\s*[\r\n]+\s*(?:gratuit|offert)/i.test(text)) {
      shippingCost = 0
    } else {
      shippingCost =
        // Horizontal summary FIRST: "Produits Livraison [Total]\n<p> € <s> €"
        // The 2nd amount after the header line is the Livraison amount.
        // Allow the two amounts to be either space-separated (same line) or
        // on consecutive lines (OCR sometimes wraps them).
        (() => {
          const m = text.match(
            /Produits\s+Livraison(?:\s+Total)?\s*[\r\n]+\s*\d[\d ]*[,.]\d{2}\s*€[\s\r\n]+(\d[\d ]*[,.]\d{2})\s*€/i
          )
          return m ? parseFrAmount(m[1]) : null
        })() ??
        // Vertical summary (single or double blank line): "Livraison\n\n7,41 €"
        firstAmount(text, /\bLivraison\s*[\r\n]+[\r\n\s]{0,20}(\d[\d ]*[,.]\d{2})\s*€/i) ??
        // Carrier slip: "Total frais de port (TTC) : 5,26 €"
        firstAmount(text, /total\s+frais\s+de\s+port[^€]{0,60}?(\d[\d ]*[,.]\d{2})\s*€/i) ??
        // Transporteurs row fallback (strict decimal; already null if garbled)
        kgRowAmount ??
        0
    }

    // ---- Total TTC: the "Documents" table "Facture #FA…" row --------------
    // Anchored on the leading date so it never matches the products table's
    // "Total Facture" header column.
    const totalTTC =
      firstAmount(text, /\d{2}\/\d{2}\/\d{4}\s+Facture\s+\S+\s+(\d[\d ]*[,.]\d{2})\s*€/i) ??
      firstAmount(text, /\d{2}\/\d{2}\/\d{4}\s+Bon\s+de\s+livraison\s+\S+\s+(\d[\d ]*[,.]\d{2})\s*€/i) ??
      // Last resort: largest strict-decimal amount on the page.
      maxStrictAmount(text)

    const deliveryMode = carrierName || TRANSPORTER_DEFAULT_MODE[orderTransporter]

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
  retrait: 'Retrait magasin',
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
    // A page with an order number that is NOT an Oxatis invoice is a PrestaShop
    // order whose markers were garbled by OCR — route it to the PrestaShop parser
    // rather than letting it fall through to a parser that would drop it entirely.
    if (/Commande\s*#?\s*\d+/i.test(text) && !/Montant Total TTC/i.test(text)) {
      format = 'prestashop-order'
    } else {
      format =
        company === 'jocondienne'
          ? 'jocondienne'
          : company === 'amazon'
            ? 'amazon'
            : 'duhalle-oxatis'
    }
  }

  // Trust the content for the company when it carries an explicit signal.
  const resolvedCompany =
    companyFromFormat(format) ?? detectCompanyFromText(text) ?? company

  if (format === 'amazon') {
    const { orders, errors } = parseAmazonOrder(text, resolvedCompany)
    return { orders, disputes: [], errors, format }
  }
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

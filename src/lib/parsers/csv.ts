import Papa from 'papaparse'
import type { Order, Transporter, Company } from '../types'

export interface ParsedCSVResult {
  orders: Order[]
  errors: string[]
}

function detectTransporterFromHeaders(headers: string[]): Transporter | null {
  const headerStr = headers.join(' ').toLowerCase()

  if (headerStr.includes('colissimo') || headerStr.includes('code produit')) {
    return 'colissimo'
  }
  if (headerStr.includes('dpd') || headerStr.includes('parcel')) {
    return 'dpd'
  }
  if (headerStr.includes('geodis') || headerStr.includes('geo')) {
    return 'geodis'
  }
  return null
}

function normalizeShippingCost(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0
  const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '')
  return parseFloat(str) || 0
}

function normalizeDate(val: string | undefined): string {
  if (!val) return ''
  // Try various date formats
  const cleaned = val.trim()

  // DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10)
  }

  return cleaned
}

function parseColissimoRow(
  row: Record<string, string>,
  company: Company,
  index: number
): Order | null {
  // Colissimo typical headers: N° commande, Date commande, Mode livraison, Total TTC, Frais de port
  const idKeys = ['N° commande', 'Numéro commande', 'Commande', 'Reference', 'Ref', 'N°']
  const dateKeys = ['Date commande', 'Date', 'Date de commande']
  const modeKeys = ['Mode livraison', 'Mode de livraison', 'Livraison', 'Transport']
  const totalKeys = ['Total TTC', 'Montant TTC', 'Total', 'Montant']
  const shippingKeys = ['Frais de port', 'Port', 'Shipping', 'Livraison TTC']

  const getId = (keys: string[]) =>
    keys.map((k) => row[k]).find((v) => v !== undefined && v !== '')
  const id =
    getId(idKeys) || `CMD-COLIS-${index}`
  const date = normalizeDate(getId(dateKeys))
  const deliveryMode = getId(modeKeys) || 'Colissimo Standard'
  const totalTTC = parseFloat(
    String(getId(totalKeys) || '0').replace(',', '.').replace(/[^0-9.]/g, '')
  ) || 0
  const shippingCost = normalizeShippingCost(getId(shippingKeys))

  return {
    id: String(id).trim(),
    date,
    company,
    transporter: 'colissimo',
    totalTTC,
    shippingCost,
    deliveryMode,
  }
}

function parseDPDRow(
  row: Record<string, string>,
  company: Company,
  index: number
): Order | null {
  const idKeys = ['N° commande', 'Commande', 'Reference', 'Numero', 'N°', 'Order']
  const dateKeys = ['Date', 'Date commande', 'Date expédition']
  const modeKeys = ['Service', 'Mode livraison', 'Produit']
  const totalKeys = ['Total TTC', 'Montant', 'Total']
  const shippingKeys = ['Frais de port', 'Port', 'Frais', 'Shipping']

  const getId = (keys: string[]) =>
    keys.map((k) => row[k]).find((v) => v !== undefined && v !== '')

  const id = getId(idKeys) || `CMD-DPD-${index}`
  const date = normalizeDate(getId(dateKeys))
  const deliveryMode = getId(modeKeys) || 'DPD Classic'
  const totalTTC = parseFloat(
    String(getId(totalKeys) || '0').replace(',', '.').replace(/[^0-9.]/g, '')
  ) || 0
  const shippingCost = normalizeShippingCost(getId(shippingKeys))

  return {
    id: String(id).trim(),
    date,
    company,
    transporter: 'dpd',
    totalTTC,
    shippingCost,
    deliveryMode,
  }
}

function parseGEODISRow(
  row: Record<string, string>,
  company: Company,
  index: number
): Order | null {
  const idKeys = ['N° commande', 'Commande', 'Reference', 'Numero colis', 'N°']
  const dateKeys = ['Date', 'Date livraison', 'Date commande']
  const modeKeys = ['Service', 'Mode', 'Type envoi']
  const totalKeys = ['Total TTC', 'Montant', 'Total']
  const shippingKeys = ['Frais de port', 'Port', 'Frais', 'Montant port']

  const getId = (keys: string[]) =>
    keys.map((k) => row[k]).find((v) => v !== undefined && v !== '')

  const id = getId(idKeys) || `CMD-GEO-${index}`
  const date = normalizeDate(getId(dateKeys))
  const deliveryMode = getId(modeKeys) || 'GEODIS Standard'
  const totalTTC = parseFloat(
    String(getId(totalKeys) || '0').replace(',', '.').replace(/[^0-9.]/g, '')
  ) || 0
  const shippingCost = normalizeShippingCost(getId(shippingKeys))

  return {
    id: String(id).trim(),
    date,
    company,
    transporter: 'geodis',
    totalTTC,
    shippingCost,
    deliveryMode,
  }
}

export function parseCSV(
  content: string,
  company: Company,
  transporter?: Transporter
): ParsedCSVResult {
  const errors: string[] = []
  const orders: Order[] = []

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',
    dynamicTyping: false,
  })

  if (result.errors.length > 0) {
    errors.push(...result.errors.map((e) => `CSV parse error: ${e.message}`))
  }

  if (!result.data || result.data.length === 0) {
    return { orders, errors: [...errors, 'No data found in CSV'] }
  }

  const headers = result.meta.fields || []
  const detectedTransporter = transporter || detectTransporterFromHeaders(headers) || 'colissimo'

  result.data.forEach((row, idx) => {
    try {
      let order: Order | null = null

      if (detectedTransporter === 'colissimo') {
        order = parseColissimoRow(row, company, idx)
      } else if (detectedTransporter === 'dpd') {
        order = parseDPDRow(row, company, idx)
      } else if (detectedTransporter === 'geodis') {
        order = parseGEODISRow(row, company, idx)
      }

      if (order) {
        orders.push(order)
      }
    } catch (err) {
      errors.push(`Row ${idx + 1}: ${err instanceof Error ? err.message : 'Parse error'}`)
    }
  })

  return { orders, errors }
}

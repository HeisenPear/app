import ExcelJS from 'exceljs'
import type { Order, Dispute, Transporter, Company } from '../types'

export interface ParsedExcelResult {
  orders: Order[]
  disputes: Dispute[]
  errors: string[]
}

function normalizeDate(val: string | Date | undefined | null): string {
  if (!val) return ''
  if (val instanceof Date) {
    return val.toISOString().substring(0, 10)
  }
  const cleaned = String(val).trim()
  const dmyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10)
  }
  return cleaned
}

function cellValue(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return ''
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    return String((cell.value as ExcelJS.CellFormulaValue).result || '')
  }
  if (cell.value instanceof Date) {
    return normalizeDate(cell.value)
  }
  return String(cell.value)
}

function cellNumber(cell: ExcelJS.Cell): number {
  const val = cellValue(cell)
  return parseFloat(val.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0
}

export async function parseExcel(
  buffer: Buffer,
  company: Company,
  transporter?: Transporter,
  fileType: 'commandes' | 'litiges' = 'commandes'
): Promise<ParsedExcelResult> {
  const errors: string[] = []
  const orders: Order[] = []
  const disputes: Dispute[] = []

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return { orders, disputes, errors: ['No sheets found in Excel file'] }
  }

  // Read header row (typically row 1 or 2)
  let headerRow = 1
  const firstRow = sheet.getRow(1)
  const firstRowValues = firstRow.values as (string | null)[]
  if (
    firstRowValues.every((v) => !v || typeof v !== 'string' || v.length < 3)
  ) {
    headerRow = 2
  }

  const headers: Record<number, string> = {}
  const hRow = sheet.getRow(headerRow)
  hRow.eachCell((cell, colNum) => {
    headers[colNum] = cellValue(cell).toLowerCase().trim()
  })

  const findCol = (keywords: string[]): number => {
    for (const [colStr, header] of Object.entries(headers)) {
      const col = parseInt(colStr)
      for (const kw of keywords) {
        if (header.includes(kw.toLowerCase())) return col
      }
    }
    return -1
  }

  if (fileType === 'litiges') {
    // Parse disputes file
    const refCol = findCol(['ref', 'commande', 'numéro', 'numero', 'n°'])
    const dateCol = findCol(['date'])
    const typeCol = findCol(['type', 'motif', 'nature'])
    const amountCol = findCol(['montant', 'amount', 'valeur'])
    const statusCol = findCol(['statut', 'status', 'état'])
    const descCol = findCol(['description', 'commentaire', 'détail'])

    const detectedTransporter = transporter || 'colissimo'

    sheet.eachRow((row, rowNum) => {
      if (rowNum <= headerRow) return
      const rowVals = row.values as (ExcelJS.CellValue | null)[]
      if (rowVals.every((v) => !v)) return

      const dispute: Dispute = {
        orderRef: refCol > 0 ? cellValue(row.getCell(refCol)) : `LIT-${rowNum}`,
        company,
        transporter: detectedTransporter,
        type: typeCol > 0 ? cellValue(row.getCell(typeCol)) : 'Litige',
        amount: amountCol > 0 ? cellNumber(row.getCell(amountCol)) : 0,
        status: statusCol > 0 ? cellValue(row.getCell(statusCol)) : 'En cours',
        date: dateCol > 0 ? normalizeDate(cellValue(row.getCell(dateCol))) : '',
        description: descCol > 0 ? cellValue(row.getCell(descCol)) : undefined,
      }

      if (dispute.orderRef) {
        disputes.push(dispute)
      }
    })
  } else {
    // Parse orders file
    const idCol = findCol(['commande', 'numéro', 'numero', 'n°', 'ref', 'id'])
    const dateCol = findCol(['date'])
    const modeCol = findCol(['mode', 'livraison', 'transport', 'service'])
    const totalCol = findCol(['total ttc', 'total', 'montant ttc', 'montant'])
    const shippingCol = findCol(['frais de port', 'port', 'shipping', 'frais'])

    const detectedTransporter = transporter || 'colissimo'

    sheet.eachRow((row, rowNum) => {
      if (rowNum <= headerRow) return
      const rowVals = row.values as (ExcelJS.CellValue | null)[]
      if (rowVals.every((v) => !v)) return

      const idVal = idCol > 0 ? cellValue(row.getCell(idCol)) : ''
      if (!idVal) return

      const order: Order = {
        id: idVal.trim(),
        date: dateCol > 0 ? normalizeDate(cellValue(row.getCell(dateCol))) : '',
        company,
        transporter: detectedTransporter,
        totalTTC: totalCol > 0 ? cellNumber(row.getCell(totalCol)) : 0,
        shippingCost: shippingCol > 0 ? cellNumber(row.getCell(shippingCol)) : 0,
        deliveryMode: modeCol > 0 ? cellValue(row.getCell(modeCol)) : 'Standard',
      }

      orders.push(order)
    })
  }

  return { orders, disputes, errors }
}

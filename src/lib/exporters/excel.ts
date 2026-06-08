import ExcelJS from 'exceljs'
import type { ProcessedData, CompanyReport, Order } from '../types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '../types'
import { EXCEL_COLORS, EXCEL_FONTS, EXCEL_ROW_HEIGHTS, SHIPPING_RATES, RATE_LABELS, RATE_STATUS } from '../constants'

type RGB = { argb: string }

function hex(color: string): RGB {
  return { argb: 'FF' + color.replace('#', '') }
}

function border(style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> {
  const b: ExcelJS.Border = { style, color: hex('#CCCCCC') }
  return { top: b, left: b, bottom: b, right: b }
}

function applyHeaderStyle(
  row: ExcelJS.Row,
  bgColor: string,
  textColor: string = '#FFFFFF',
  fontSize: number = 10,
  bold: boolean = true
) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
    cell.font = { bold, size: fontSize, color: hex(textColor), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
}

function getTransporterColors(transporter: string) {
  switch (transporter) {
    case 'dpd':
      return {
        primary: EXCEL_COLORS.darkRed,
        secondary: EXCEL_COLORS.mediumRed,
        accent: EXCEL_COLORS.lightRed,
      }
    case 'geodis':
      return {
        primary: EXCEL_COLORS.darkBlue,
        secondary: EXCEL_COLORS.mediumBlue,
        accent: EXCEL_COLORS.lightBlue,
      }
    default:
      return {
        primary: EXCEL_COLORS.darkGreen,
        secondary: EXCEL_COLORS.mediumGreen,
        accent: EXCEL_COLORS.lightGreen,
      }
  }
}

/**
 * Build Sheet 1: "📊 Récapitulatif"
 */
function buildRecapSheet(ws: ExcelJS.Worksheet, report: CompanyReport, colors: ReturnType<typeof getTransporterColors>) {
  ws.getColumn('A').width = 38
  ws.getColumn('B').width = 22
  ws.getColumn('C').width = 18
  ws.getColumn('D').width = 20

  const { stats } = report
  const companyName = COMPANY_LABELS[report.company]
  const transporterName = TRANSPORTER_LABELS[report.transporter]

  // Row 1 — Title
  ws.mergeCells('A1:D1')
  const titleRow = ws.getRow(1)
  titleRow.height = EXCEL_ROW_HEIGHTS.title
  const titleCell = ws.getCell('A1')
  titleCell.value = `📊 Frais de port — ${companyName} (${transporterName})`
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
  titleCell.font = { bold: true, size: EXCEL_FONTS.titleSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // Row 2 — Subtitle
  ws.mergeCells('A2:D2')
  const subtitleRow = ws.getRow(2)
  subtitleRow.height = EXCEL_ROW_HEIGHTS.subtitle
  const subtitleCell = ws.getCell('A2')
  subtitleCell.value = report.period ? `Période : ${report.period}` : `Généré le ${new Date().toLocaleDateString('fr-FR')}`
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.secondary) }
  subtitleCell.font = { size: 10, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // Row 3 — Spacer
  ws.getRow(3).height = EXCEL_ROW_HEIGHTS.spacer

  // Row 4 — Section: INDICATEURS CLÉS
  ws.mergeCells('A4:D4')
  const sectionRow4 = ws.getRow(4)
  sectionRow4.height = EXCEL_ROW_HEIGHTS.section
  const sectionCell4 = ws.getCell('A4')
  sectionCell4.value = 'INDICATEURS CLÉS'
  sectionCell4.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.accent) }
  sectionCell4.font = { bold: true, size: 11, color: hex(colors.primary), name: 'Calibri' }
  sectionCell4.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  // Row 5 — Total orders
  const row5 = ws.getRow(5)
  row5.height = EXCEL_ROW_HEIGHTS.totalOrders
  ws.getCell('A5').value = 'Nombre total de commandes'
  ws.getCell('B5').value = stats.totalOrders
  ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: hex(EXCEL_COLORS.veryLightGreen) }
  ws.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: hex(EXCEL_COLORS.veryLightGreen) }
  ws.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: hex(EXCEL_COLORS.veryLightGreen) }
  ws.getCell('D5').fill = { type: 'pattern', pattern: 'solid', fgColor: hex(EXCEL_COLORS.veryLightGreen) }
  ws.getCell('A5').font = { size: 10, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri' }
  ws.getCell('B5').font = { bold: true, size: 10, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri' }
  ws.getCell('B5').alignment = { horizontal: 'center', vertical: 'middle' }

  // Row 6 — Free shipping
  const row6 = ws.getRow(6)
  row6.height = 21
  ws.getCell('A6').value = 'Dont frais de port offerts'
  ws.getCell('B6').value = stats.freeShippingOrders
  ws.getCell('C6').value = { formula: 'B6/B5', result: stats.totalOrders > 0 ? stats.freeShippingOrders / stats.totalOrders : 0 }
  ws.getCell('C6').numFmt = '0.0%'
  ;['A6', 'B6', 'C6', 'D6'].forEach(addr => {
    ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: hex(EXCEL_COLORS.freeShippingBg) }
    ws.getCell(addr).font = { bold: true, size: 10, color: hex(EXCEL_COLORS.freeShippingBlue), name: 'Calibri' }
  })
  ws.getCell('B6').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell('C6').alignment = { horizontal: 'center', vertical: 'middle' }

  // Row 7 — Paid shipping
  const row7 = ws.getRow(7)
  row7.height = 21
  ws.getCell('A7').value = 'Dont frais de port payants'
  ws.getCell('B7').value = stats.paidShippingOrders
  ws.getCell('C7').value = { formula: 'B7/B5', result: stats.totalOrders > 0 ? stats.paidShippingOrders / stats.totalOrders : 0 }
  ws.getCell('C7').numFmt = '0.0%'
  ;['A7', 'B7', 'C7', 'D7'].forEach(addr => {
    ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: hex(EXCEL_COLORS.lightGrey) }
    ws.getCell(addr).font = { size: 10, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri' }
  })
  ws.getCell('B7').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell('C7').alignment = { horizontal: 'center', vertical: 'middle' }

  // Row 8 — Empty
  ws.getRow(8).height = 8

  // Row 9 — Section: DISTRIBUTION DES FRAIS DE PORT
  ws.mergeCells('A9:D9')
  const sectionRow9 = ws.getRow(9)
  sectionRow9.height = EXCEL_ROW_HEIGHTS.section
  const sectionCell9 = ws.getCell('A9')
  sectionCell9.value = 'DISTRIBUTION DES FRAIS DE PORT'
  sectionCell9.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.accent) }
  sectionCell9.font = { bold: true, size: 11, color: hex(colors.primary), name: 'Calibri' }
  sectionCell9.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  // Row 10 — Column headers
  const row10 = ws.getRow(10)
  row10.height = EXCEL_ROW_HEIGHTS.colHeader
  const headers10 = ['Frais de port', 'Nb commandes', '% du total', 'Statut']
  headers10.forEach((h, i) => {
    const cell = ws.getCell(10, i + 1)
    cell.value = h
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
    cell.font = { bold: true, size: EXCEL_FONTS.headerSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
  })

  // Rows 11-15 — Rate tiers
  const rateDataStartRow = 11
  SHIPPING_RATES.forEach((rate, idx) => {
    const rowNum = rateDataStartRow + idx
    const entry = stats.distribution.find(d => d.rate === rate) || { rate, count: 0, subtotal: 0, percentage: 0 }
    const row = ws.getRow(rowNum)
    row.height = 21

    const isFree = rate === 0
    const isLast = idx === SHIPPING_RATES.length - 1

    const bgColor = isFree
      ? EXCEL_COLORS.freeShippingBg
      : isLast
        ? EXCEL_COLORS.yellow
        : idx % 2 === 0
          ? EXCEL_COLORS.white
          : EXCEL_COLORS.lightGrey

    const textColor = isFree ? EXCEL_COLORS.freeShippingBlue : EXCEL_COLORS.darkGrey
    const bold = isFree

    const totalCount = stats.distribution.reduce((s, d) => s + d.count, 0)
    const totalCountRef = totalCount || 1

    const cells = [
      { col: 1, value: RATE_LABELS[rate] || `${rate} €` },
      { col: 2, value: entry.count },
      {
        col: 3,
        value: { formula: `B${rowNum}/B${rateDataStartRow + SHIPPING_RATES.length}`, result: entry.count / totalCountRef },
        numFmt: '0.0%',
      },
      { col: 4, value: RATE_STATUS[rate] || '🔵 Payants' },
    ]

    cells.forEach(({ col, value, numFmt }) => {
      const cell = ws.getCell(rowNum, col)
      cell.value = value as ExcelJS.CellValue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
      cell.font = { bold, size: 10, color: hex(textColor), name: 'Calibri' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border()
      if (numFmt) cell.numFmt = numFmt
    })

    // Rate label left-aligned
    ws.getCell(rowNum, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getCell(rowNum, 4).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  })

  // Row 16 — TOTAL
  const totalRow1Num = rateDataStartRow + SHIPPING_RATES.length
  const totalRow1 = ws.getRow(totalRow1Num)
  totalRow1.height = EXCEL_ROW_HEIGHTS.colHeader
  const totalCount1 = stats.distribution.reduce((s, d) => s + d.count, 0)

  const totalCells = [
    { col: 1, value: 'TOTAL' },
    { col: 2, value: totalCount1 },
    { col: 3, value: 1, numFmt: '0.0%' },
    { col: 4, value: '' },
  ]
  totalCells.forEach(({ col, value, numFmt }) => {
    const cell = ws.getCell(totalRow1Num, col)
    cell.value = value as ExcelJS.CellValue
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
    cell.font = { bold: true, size: 10, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
    if (numFmt) cell.numFmt = numFmt
  })
  ws.getCell(totalRow1Num, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  // Row 17 — Empty
  ws.getRow(totalRow1Num + 1).height = 8

  // Row 18 — Section: COÛT TOTAL DES FRAIS DE PORT
  const section2Row = totalRow1Num + 2
  ws.mergeCells(`A${section2Row}:D${section2Row}`)
  const sectionCell18 = ws.getCell(`A${section2Row}`)
  sectionCell18.value = 'COÛT TOTAL DES FRAIS DE PORT'
  sectionCell18.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.accent) }
  sectionCell18.font = { bold: true, size: 11, color: hex(colors.primary), name: 'Calibri' }
  sectionCell18.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(section2Row).height = EXCEL_ROW_HEIGHTS.section

  // Row 19 — Column headers for cost section
  const colHeader2Row = section2Row + 1
  const row19 = ws.getRow(colHeader2Row)
  row19.height = EXCEL_ROW_HEIGHTS.colHeader
  const headers19 = ['Frais de port', 'Nb commandes', 'Sous-total', 'Coût moyen']
  headers19.forEach((h, i) => {
    const cell = ws.getCell(colHeader2Row, i + 1)
    cell.value = h
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
    cell.font = { bold: true, size: EXCEL_FONTS.headerSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
  })

  // Rows 20-24 — Cost data rows
  const costDataStartRow = colHeader2Row + 1
  SHIPPING_RATES.forEach((rate, idx) => {
    const rowNum = costDataStartRow + idx
    const entry = stats.distribution.find(d => d.rate === rate) || { rate, count: 0, subtotal: 0, percentage: 0 }
    const row = ws.getRow(rowNum)
    row.height = 21

    const isFree = rate === 0
    const isLast = idx === SHIPPING_RATES.length - 1
    const bgColor = isFree
      ? EXCEL_COLORS.freeShippingBg
      : isLast
        ? EXCEL_COLORS.yellow
        : idx % 2 === 0
          ? EXCEL_COLORS.white
          : EXCEL_COLORS.lightGrey
    const textColor = isFree ? EXCEL_COLORS.freeShippingBlue : EXCEL_COLORS.darkGrey

    const avgCost = entry.count > 0 ? entry.subtotal / entry.count : 0

    ;[
      { col: 1, value: RATE_LABELS[rate] || `${rate} €` },
      { col: 2, value: entry.count },
      { col: 3, value: entry.subtotal, numFmt: '#,##0.00 €' },
      { col: 4, value: avgCost, numFmt: '#,##0.00 €' },
    ].forEach(({ col, value, numFmt }) => {
      const cell = ws.getCell(rowNum, col)
      cell.value = value as ExcelJS.CellValue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
      cell.font = { size: 10, color: hex(textColor), name: 'Calibri' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border()
      if (numFmt) cell.numFmt = numFmt
    })
    ws.getCell(rowNum, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  })

  // Row 25 — TOTAL cost
  const totalRow2Num = costDataStartRow + SHIPPING_RATES.length
  const totalRow2 = ws.getRow(totalRow2Num)
  totalRow2.height = EXCEL_ROW_HEIGHTS.colHeader
  ;[
    { col: 1, value: 'TOTAL' },
    { col: 2, value: stats.totalOrders },
    { col: 3, value: stats.totalShippingCost, numFmt: '#,##0.00 €' },
    { col: 4, value: stats.totalOrders > 0 ? stats.totalShippingCost / stats.totalOrders : 0, numFmt: '#,##0.00 €' },
  ].forEach(({ col, value, numFmt }) => {
    const cell = ws.getCell(totalRow2Num, col)
    cell.value = value as ExcelJS.CellValue
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
    cell.font = { bold: true, size: 10, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
    if (numFmt) cell.numFmt = numFmt
  })
  ws.getCell(totalRow2Num, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
}

/**
 * Build Sheet 2: "📋 Détail commandes"
 */
function buildDetailSheet(ws: ExcelJS.Worksheet, report: CompanyReport, colors: ReturnType<typeof getTransporterColors>) {
  ws.getColumn('A').width = 18
  ws.getColumn('B').width = 20
  ws.getColumn('C').width = 50
  ws.getColumn('D').width = 18
  ws.getColumn('E').width = 14
  ws.getColumn('F').width = 30

  const companyName = COMPANY_LABELS[report.company]
  const transporterName = TRANSPORTER_LABELS[report.transporter]

  // Row 1 — Title
  ws.mergeCells('A1:F1')
  const titleRow = ws.getRow(1)
  titleRow.height = EXCEL_ROW_HEIGHTS.title - 4.5
  const titleCell = ws.getCell('A1')
  titleCell.value = `📋 Détail commandes — ${companyName} (${transporterName})`
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
  titleCell.font = { bold: true, size: 13, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // Row 2 — Column headers
  const row2 = ws.getRow(2)
  row2.height = EXCEL_ROW_HEIGHTS.colHeader
  const headers = ['N° Commande', 'Date', 'Mode de livraison', 'Total TTC', 'Frais de port', 'Statut port']
  headers.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1)
    cell.value = h
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
    cell.font = { bold: true, size: EXCEL_FONTS.headerSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
  })

  // Data rows
  report.orders.forEach((order, idx) => {
    const rowNum = idx + 3
    const row = ws.getRow(rowNum)
    row.height = EXCEL_ROW_HEIGHTS.data

    const isFree = order.shippingCost === 0
    const isOdd = idx % 2 !== 0
    const bgColor = isFree
      ? EXCEL_COLORS.freeShippingBg
      : isOdd
        ? EXCEL_COLORS.lightGrey
        : EXCEL_COLORS.white

    const formatDate = (date: string) => {
      if (!date) return ''
      const parts = date.split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
      return date
    }

    const cells = [
      { col: 1, value: order.id },
      { col: 2, value: formatDate(order.date) },
      { col: 3, value: order.deliveryMode },
      { col: 4, value: order.totalTTC, numFmt: '#,##0.00 €' },
      { col: 5, value: order.shippingCost, numFmt: '#,##0.00 €' },
      { col: 6, value: isFree ? '🟢 Offerts' : '🔵 Payants' },
    ]

    cells.forEach(({ col, value, numFmt }) => {
      const cell = ws.getCell(rowNum, col)
      cell.value = value as ExcelJS.CellValue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
      cell.font = {
        size: EXCEL_FONTS.dataSize,
        color: hex(EXCEL_COLORS.darkGrey),
        name: 'Calibri',
        bold: isFree && (col === 1),
      }
      cell.alignment = { horizontal: col <= 2 || col === 6 ? 'left' : 'center', vertical: 'middle' }
      cell.border = border()
      if (numFmt) cell.numFmt = numFmt
    })

    // Free shipping amount in blue
    if (isFree) {
      ws.getCell(rowNum, 5).font = { bold: true, size: EXCEL_FONTS.dataSize, color: hex(EXCEL_COLORS.freeShippingBlue), name: 'Calibri' }
    }
  })
}

/**
 * Build Sheet 3: "🔍 Commandes par tarif"
 */
function buildByRateSheet(ws: ExcelJS.Worksheet, report: CompanyReport, colors: ReturnType<typeof getTransporterColors>) {
  ws.getColumn('A').width = 18
  ws.getColumn('B').width = 20
  ws.getColumn('C').width = 30
  ws.getColumn('D').width = 18
  ws.getColumn('E').width = 14

  const companyName = COMPANY_LABELS[report.company]
  const transporterName = TRANSPORTER_LABELS[report.transporter]

  // Row 1 — Title
  ws.mergeCells('A1:E1')
  const titleRow = ws.getRow(1)
  titleRow.height = EXCEL_ROW_HEIGHTS.title - 4.5
  const titleCell = ws.getCell('A1')
  titleCell.value = `🔍 Commandes par tarif — ${companyName} (${transporterName})`
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
  titleCell.font = { bold: true, size: 12, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  let currentRow = 3

  for (const rate of SHIPPING_RATES) {
    const rateOrders = report.orders.filter(o => Math.abs(o.shippingCost - rate) < 0.01)
    if (rateOrders.length === 0) continue

    const isFree = rate === 0
    const rateLabel = RATE_LABELS[rate] || `${rate} €`

    // Banner row
    ws.mergeCells(`A${currentRow}:E${currentRow}`)
    const bannerCell = ws.getCell(`A${currentRow}`)
    bannerCell.value = isFree
      ? `🟢 FRAIS DE PORT OFFERTS — 0,00 € (${rateOrders.length} commande${rateOrders.length > 1 ? 's' : ''})`
      : `📦 ${rateLabel} — ${rateOrders.length} commande${rateOrders.length > 1 ? 's' : ''}`

    bannerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: hex(isFree ? EXCEL_COLORS.freeShippingBg : colors.accent),
    }
    bannerCell.font = {
      bold: true,
      size: 10,
      color: hex(isFree ? EXCEL_COLORS.freeShippingBlue : colors.primary),
      name: 'Calibri',
    }
    bannerCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(currentRow).height = EXCEL_ROW_HEIGHTS.colHeader
    currentRow++

    // Column headers
    const headerRow = ws.getRow(currentRow)
    headerRow.height = EXCEL_ROW_HEIGHTS.data
    const colHeaders = ['N° Commande', 'Date', 'Mode de livraison', 'Total TTC', 'Frais de port']
    colHeaders.forEach((h, i) => {
      const cell = ws.getCell(currentRow, i + 1)
      cell.value = h
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.secondary) }
      cell.font = { bold: true, size: 9, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border()
    })
    currentRow++

    // Data rows
    rateOrders.forEach((order, idx) => {
      const row = ws.getRow(currentRow)
      row.height = EXCEL_ROW_HEIGHTS.dataSmall

      const bgColor = idx % 2 === 0 ? EXCEL_COLORS.white : EXCEL_COLORS.lightGrey

      const formatDate = (date: string) => {
        if (!date) return ''
        const parts = date.split('-')
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
        return date
      }

      ;[
        { col: 1, value: order.id },
        { col: 2, value: formatDate(order.date) },
        { col: 3, value: order.deliveryMode },
        { col: 4, value: order.totalTTC, numFmt: '#,##0.00 €' },
        { col: 5, value: order.shippingCost, numFmt: '#,##0.00 €' },
      ].forEach(({ col, value, numFmt }) => {
        const cell = ws.getCell(currentRow, col)
        cell.value = value as ExcelJS.CellValue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
        cell.font = { size: EXCEL_FONTS.dataSize, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri' }
        cell.alignment = { horizontal: col === 1 || col === 2 ? 'left' : 'center', vertical: 'middle' }
        cell.border = border()
        if (numFmt) cell.numFmt = numFmt
      })

      if (isFree) {
        ws.getCell(currentRow, 5).font = { bold: true, size: EXCEL_FONTS.dataSize, color: hex(EXCEL_COLORS.freeShippingBlue), name: 'Calibri' }
      }

      currentRow++
    })

    // Empty separator
    currentRow++
  }
}

/**
 * Build disputes sheet
 */
function buildDisputesSheet(ws: ExcelJS.Worksheet, reports: CompanyReport[]) {
  ws.getColumn('A').width = 18
  ws.getColumn('B').width = 22
  ws.getColumn('C').width = 22
  ws.getColumn('D').width = 18
  ws.getColumn('E').width = 16
  ws.getColumn('F').width = 18
  ws.getColumn('G').width = 40

  // Title
  ws.mergeCells('A1:G1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '⚠️ Litiges transporteurs'
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex('#7B1A1A') }
  titleCell.font = { bold: true, size: 13, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = EXCEL_ROW_HEIGHTS.title - 4.5

  // Column headers
  const row2 = ws.getRow(2)
  row2.height = EXCEL_ROW_HEIGHTS.colHeader
  const headers = ['N° Commande', 'Entreprise', 'Transporteur', 'Date', 'Montant', 'Statut', 'Description']
  headers.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1)
    cell.value = h
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex('#7B1A1A') }
    cell.font = { bold: true, size: EXCEL_FONTS.headerSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
  })

  const allDisputes = reports.flatMap(r => r.disputes)

  allDisputes.forEach((dispute, idx) => {
    const rowNum = idx + 3
    const row = ws.getRow(rowNum)
    row.height = EXCEL_ROW_HEIGHTS.data

    const bgColor = idx % 2 === 0 ? EXCEL_COLORS.white : EXCEL_COLORS.lightGrey

    ;[
      { col: 1, value: dispute.orderRef },
      { col: 2, value: COMPANY_LABELS[dispute.company] },
      { col: 3, value: TRANSPORTER_LABELS[dispute.transporter] },
      { col: 4, value: dispute.date },
      { col: 5, value: dispute.amount, numFmt: '#,##0.00 €' },
      { col: 6, value: dispute.status },
      { col: 7, value: dispute.description || '' },
    ].forEach(({ col, value, numFmt }) => {
      const cell = ws.getCell(rowNum, col)
      cell.value = value as ExcelJS.CellValue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
      cell.font = { size: EXCEL_FONTS.dataSize, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri' }
      cell.alignment = { horizontal: 'left', vertical: 'middle' }
      cell.border = border()
      if (numFmt) cell.numFmt = numFmt
    })
  })

  if (allDisputes.length === 0) {
    ws.mergeCells('A3:G3')
    ws.getCell('A3').value = 'Aucun litige enregistré'
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getCell('A3').font = { size: 10, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri', italic: true }
    ws.getRow(3).height = 28
  }
}

/**
 * Build combined global recap sheet
 */
function buildGlobalRecapSheet(ws: ExcelJS.Worksheet, data: ProcessedData) {
  ws.getColumn('A').width = 38
  ws.getColumn('B').width = 22
  ws.getColumn('C').width = 18
  ws.getColumn('D').width = 20

  const colors = {
    primary: EXCEL_COLORS.darkGreen,
    secondary: EXCEL_COLORS.mediumGreen,
    accent: EXCEL_COLORS.lightGreen,
  }

  // Row 1 — Title
  ws.mergeCells('A1:D1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '📊 Récapitulatif global — Tous transporteurs'
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
  titleCell.font = { bold: true, size: EXCEL_FONTS.titleSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = EXCEL_ROW_HEIGHTS.title

  // Row 2 — Subtitle
  ws.mergeCells('A2:D2')
  const subtitleCell = ws.getCell('A2')
  subtitleCell.value = `Généré le ${new Date().toLocaleDateString('fr-FR')} — ${data.reports.length} rapport(s)`
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.secondary) }
  subtitleCell.font = { size: 10, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = EXCEL_ROW_HEIGHTS.subtitle

  ws.getRow(3).height = EXCEL_ROW_HEIGHTS.spacer

  // Global stats
  const g = data.globalStats

  ws.mergeCells('A4:D4')
  ws.getCell('A4').value = 'INDICATEURS GLOBAUX'
  ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.accent) }
  ws.getCell('A4').font = { bold: true, size: 11, color: hex(colors.primary), name: 'Calibri' }
  ws.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(4).height = EXCEL_ROW_HEIGHTS.section

  const globalRows = [
    { label: 'Total commandes', value: g.totalOrders, bg: EXCEL_COLORS.veryLightGreen },
    { label: 'Frais de port offerts', value: g.freeShippingOrders, bg: EXCEL_COLORS.freeShippingBg, color: EXCEL_COLORS.freeShippingBlue },
    { label: 'Frais de port payants', value: g.paidShippingOrders, bg: EXCEL_COLORS.lightGrey },
    { label: 'Coût total frais de port', value: g.totalShippingCost, bg: EXCEL_COLORS.white, numFmt: '#,##0.00 €' },
    { label: 'Valeur totale commandes', value: g.totalOrderValue, bg: EXCEL_COLORS.white, numFmt: '#,##0.00 €' },
  ]

  globalRows.forEach(({ label, value, bg, color, numFmt }, idx) => {
    const rowNum = 5 + idx
    ws.getRow(rowNum).height = EXCEL_ROW_HEIGHTS.totalOrders

    const aCell = ws.getCell(`A${rowNum}`)
    const bCell = ws.getCell(`B${rowNum}`)

    aCell.value = label
    bCell.value = value as ExcelJS.CellValue

    ;[`A${rowNum}`, `B${rowNum}`, `C${rowNum}`, `D${rowNum}`].forEach(addr => {
      ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) }
    })

    aCell.font = { size: 10, color: hex(color || EXCEL_COLORS.darkGrey), name: 'Calibri' }
    bCell.font = { bold: true, size: 10, color: hex(color || EXCEL_COLORS.darkGrey), name: 'Calibri' }
    bCell.alignment = { horizontal: 'center', vertical: 'middle' }
    if (numFmt) bCell.numFmt = numFmt
  })

  let currentRow = 11

  // Per-report breakdown
  ws.mergeCells(`A${currentRow}:D${currentRow}`)
  ws.getCell(`A${currentRow}`).value = 'DÉTAIL PAR RAPPORT'
  ws.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.accent) }
  ws.getCell(`A${currentRow}`).font = { bold: true, size: 11, color: hex(colors.primary), name: 'Calibri' }
  ws.getCell(`A${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(currentRow).height = EXCEL_ROW_HEIGHTS.section
  currentRow++

  // Headers
  const reportHeaders = ['Rapport', 'Commandes', 'Port offerts', 'Coût total']
  const headerRow = ws.getRow(currentRow)
  headerRow.height = EXCEL_ROW_HEIGHTS.colHeader
  reportHeaders.forEach((h, i) => {
    const cell = ws.getCell(currentRow, i + 1)
    cell.value = h
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(colors.primary) }
    cell.font = { bold: true, size: EXCEL_FONTS.headerSize, color: hex(EXCEL_COLORS.white), name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
  })
  currentRow++

  data.reports.forEach((report, idx) => {
    const row = ws.getRow(currentRow)
    row.height = EXCEL_ROW_HEIGHTS.data
    const bgColor = idx % 2 === 0 ? EXCEL_COLORS.white : EXCEL_COLORS.lightGrey
    const label = `${COMPANY_LABELS[report.company]} — ${TRANSPORTER_LABELS[report.transporter]}`

    ;[
      { col: 1, value: label },
      { col: 2, value: report.stats.totalOrders },
      { col: 3, value: report.stats.freeShippingOrders },
      { col: 4, value: report.stats.totalShippingCost, numFmt: '#,##0.00 €' },
    ].forEach(({ col, value, numFmt }) => {
      const cell = ws.getCell(currentRow, col)
      cell.value = value as ExcelJS.CellValue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgColor) }
      cell.font = { size: 10, color: hex(EXCEL_COLORS.darkGrey), name: 'Calibri' }
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' }
      cell.border = border()
      if (numFmt) cell.numFmt = numFmt
    })
    if (idx === 1) ws.getCell(currentRow, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    currentRow++
  })
}

/**
 * Main export function
 */
export async function generateExcel(data: ProcessedData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Analyseur Frais de Port'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Global recap sheet
  const globalSheet = workbook.addWorksheet('📊 Récapitulatif global', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
    properties: { tabColor: { argb: 'FF15431F' } },
  })
  buildGlobalRecapSheet(globalSheet, data)

  // Per-report sheets
  for (const report of data.reports) {
    const colors = getTransporterColors(report.transporter)
    const companyShort = report.company === 'duhalle' ? 'DB' : 'LJ'
    const transporterShort = report.transporter.toUpperCase().substring(0, 5)

    const recapSheetName = `📊 ${companyShort}-${transporterShort}`
    const detailSheetName = `📋 ${companyShort}-${transporterShort}`
    const rateSheetName = `🔍 ${companyShort}-${transporterShort}`

    const recapSheet = workbook.addWorksheet(recapSheetName, {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
      properties: { tabColor: { argb: 'FF' + colors.primary.replace('#', '') } },
    })
    buildRecapSheet(recapSheet, report, colors)

    const detailSheet = workbook.addWorksheet(detailSheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      properties: { tabColor: { argb: 'FF' + colors.primary.replace('#', '') } },
    })
    buildDetailSheet(detailSheet, report, colors)

    const rateSheet = workbook.addWorksheet(rateSheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      properties: { tabColor: { argb: 'FF' + colors.primary.replace('#', '') } },
    })
    buildByRateSheet(rateSheet, report, colors)
  }

  // Disputes sheet
  const allDisputes = data.reports.flatMap(r => r.disputes)
  if (allDisputes.length > 0) {
    const disputesSheet = workbook.addWorksheet('⚠️ Litiges', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      properties: { tabColor: { argb: 'FF7B1A1A' } },
    })
    buildDisputesSheet(disputesSheet, data.reports)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

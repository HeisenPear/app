export const EXCEL_COLORS = {
  // Greens (Colissimo)
  darkGreen: '#15431F',
  mediumGreen: '#1F4A26',
  lightGreen: '#D4E8D6',
  veryLightGreen: '#F0F8F1',

  // Reds (DPD)
  darkRed: '#7B1A1A',
  mediumRed: '#8B2020',
  lightRed: '#F5D5D5',

  // Blues (GEODIS + free shipping)
  darkBlue: '#0D3B6E',
  mediumBlue: '#0D47A1',
  lightBlue: '#DAEAF8',
  freeShippingBlue: '#1565C0',
  freeShippingBg: '#E3F2FD',

  // Other
  yellow: '#FFF8E1',
  lightGrey: '#F5F5F5',
  darkGrey: '#4A4A4A',
  white: '#FFFFFF',
}

export const EXCEL_FONTS = {
  titleSize: 14,
  subtitleSize: 10,
  headerSize: 10,
  dataSize: 9,
  sectionSize: 11,
}

export const EXCEL_ROW_HEIGHTS = {
  title: 36,
  subtitle: 19.5,
  spacer: 12,
  section: 24,
  totalOrders: 25.5,
  colHeader: 21.75,
  data: 18,
  dataSmall: 16.5,
}

export const EXCEL_COL_WIDTHS_SHEET1 = {
  A: 38,
  B: 22,
  C: 18,
  D: 20,
}

export const EXCEL_COL_WIDTHS_SHEET2 = {
  A: 18,
  B: 20,
  C: 50,
  D: 18,
  E: 14,
  F: 30,
}

export const EXCEL_COL_WIDTHS_SHEET3 = {
  A: 18,
  B: 20,
  C: 30,
  D: 18,
  E: 14,
}

export const SHIPPING_RATES = [0, 6.9, 7.9, 9.9, 11.9]

export const RATE_LABELS: Record<number, string> = {
  0: '0,00 €',
  6.9: '6,90 €',
  7.9: '7,90 €',
  9.9: '9,90 €',
  11.9: '11,90 €',
}

export const RATE_STATUS: Record<number, string> = {
  0: '🟢 OFFERTS',
  6.9: '🔵 Payants',
  7.9: '🔵 Payants',
  9.9: '🔵 Payants',
  11.9: '🔵 Payants',
}

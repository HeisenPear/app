export type Transporter = 'colissimo' | 'dpd' | 'geodis' | 'retrait'
export type Company = 'duhalle' | 'jocondienne'
export type FileType = 'commandes' | 'litiges'

export interface Order {
  id: string
  date: string
  company: Company
  transporter: Transporter
  totalTTC: number
  shippingCost: number
  deliveryMode: string
  dispute?: Dispute
}

export interface Dispute {
  orderRef: string
  company: Company
  transporter: Transporter
  type: string
  amount: number
  status: string
  date: string
  description?: string
}

export interface ShippingStats {
  totalOrders: number
  freeShippingOrders: number
  paidShippingOrders: number
  distribution: Array<{
    rate: number
    count: number
    subtotal: number
    percentage: number
  }>
  totalShippingCost: number
  totalOrderValue: number
}

export interface CompanyReport {
  company: Company
  transporter: Transporter
  period: string
  orders: Order[]
  disputes: Dispute[]
  stats: ShippingStats
}

export interface ProcessedData {
  reports: CompanyReport[]
  globalStats: ShippingStats
  processedAt: string
}

/** A persisted source file kept alongside a processing batch. */
export interface StoredSource {
  name: string
  size: number
  type: string
  /** Internal blob pathname (not exposed to the client). */
  pathname: string
}

/** A full persisted processing run: raw files + computed report. */
export interface BatchRecord {
  id: string
  label: string
  createdAt: string
  sources: StoredSource[]
  data: ProcessedData
}

/** Lightweight batch description used for the history list. */
export interface BatchSummary {
  id: string
  label: string
  createdAt: string
  companies: Company[]
  totalOrders: number
  totalDisputes: number
  fileCount: number
}

export interface UploadedFile {
  id: string
  file: File
  company: Company
  fileType: FileType
  transporter?: Transporter
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
}

export interface AppState {
  uploadedFiles: UploadedFile[]
  processedData: ProcessedData | null
  isProcessing: boolean
  isExporting: boolean
}

export const COMPANY_LABELS: Record<Company, string> = {
  duhalle: 'Duhallé Boutique',
  jocondienne: 'La Jocondienne',
}

export const TRANSPORTER_LABELS: Record<Transporter, string> = {
  colissimo: 'Colissimo',
  dpd: 'DPD',
  geodis: 'GEODIS',
  retrait: 'Retrait magasin',
}

export const TRANSPORTER_COLORS: Record<
  Transporter,
  { primary: string; secondary: string; accent: string }
> = {
  colissimo: {
    primary: '#15431F',
    secondary: '#1F4A26',
    accent: '#D4E8D6',
  },
  dpd: {
    primary: '#7B1A1A',
    secondary: '#8B2020',
    accent: '#F5D5D5',
  },
  geodis: {
    primary: '#0D3B6E',
    secondary: '#0D47A1',
    accent: '#DAEAF8',
  },
  retrait: {
    primary: '#7A4A12',
    secondary: '#8A5616',
    accent: '#F5E6D5',
  },
}

export const SHIPPING_RATES = [0, 6.9, 7.9, 9.9, 11.9]

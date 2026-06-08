import { create } from 'zustand'
import type { ProcessedData } from '@/lib/types'

interface AppStore {
  processedData: ProcessedData | null
  isProcessing: boolean
  isExporting: boolean
  setProcessedData: (data: ProcessedData | null) => void
  setIsProcessing: (val: boolean) => void
  setIsExporting: (val: boolean) => void
  clearData: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  processedData: null,
  isProcessing: false,
  isExporting: false,

  setProcessedData: (data) => set({ processedData: data }),
  setIsProcessing: (val) => set({ isProcessing: val }),
  setIsExporting: (val) => set({ isExporting: val }),
  clearData: () => set({ processedData: null }),
}))

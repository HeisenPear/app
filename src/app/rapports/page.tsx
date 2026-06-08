'use client'

import { useState } from 'react'
import { Download, Loader2, FileText, BarChart2 } from 'lucide-react'
import { useAppStore } from '@/store'
import TransporterStats from '@/components/TransporterStats'
import OrdersTable from '@/components/OrdersTable'
import type { CompanyReport } from '@/lib/types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '@/lib/types'
import Link from 'next/link'

export default function RapportsPage() {
  const { processedData, isExporting, setIsExporting } = useAppStore()
  const [activeTab, setActiveTab] = useState<'recap' | 'orders'>('recap')
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    if (!processedData) return
    setIsExporting(true)
    setExportError(null)
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData),
      })
      if (!response.ok) throw new Error('Erreur lors de la génération Excel')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_frais_port_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setIsExporting(false)
    }
  }

  if (!processedData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#D4E8D6' }}>
            <FileText className="w-8 h-8" style={{ color: '#15431F' }} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucun rapport disponible</h2>
          <p className="text-gray-500 mb-6">Importez d&apos;abord des fichiers pour générer des rapports.</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#15431F' }}
          >
            Importer des fichiers
          </Link>
        </div>
      </div>
    )
  }

  const currentReport = selectedReport || processedData.reports[0]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Rapports</h1>
          <p className="text-gray-500 text-sm">
            {processedData.reports.length} rapport(s) — {processedData.globalStats.totalOrders} commandes
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#15431F' }}
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Export...</>
          ) : (
            <><Download className="w-4 h-4" />Exporter Excel</>
          )}
        </button>
      </div>

      {exportError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {exportError}
        </div>
      )}

      {/* Report selector */}
      {processedData.reports.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {processedData.reports.map((report) => (
            <button
              key={`${report.company}-${report.transporter}`}
              onClick={() => setSelectedReport(report)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                currentReport === report
                  ? 'text-white border-transparent'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              style={currentReport === report ? { backgroundColor: '#15431F' } : {}}
            >
              {COMPANY_LABELS[report.company]} — {TRANSPORTER_LABELS[report.transporter]}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('recap')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'recap' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Récapitulatif
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'orders' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Détail commandes
        </button>
      </div>

      {/* Content */}
      {currentReport && (
        <div>
          {activeTab === 'recap' && (
            <div className="space-y-6">
              <TransporterStats report={currentReport} />
            </div>
          )}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <OrdersTable orders={currentReport.orders} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

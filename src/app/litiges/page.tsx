'use client'

import { useState } from 'react'
import { AlertTriangle, FileText } from 'lucide-react'
import { useAppStore } from '@/store'
import DisputesTable from '@/components/DisputesTable'
import type { Dispute } from '@/lib/types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '@/lib/types'
import Link from 'next/link'

export default function LitigesPage() {
  const { processedData } = useAppStore()
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [transporterFilter, setTransporterFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  if (!processedData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-50">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucun litige disponible</h2>
          <p className="text-gray-500 mb-6">Importez d&apos;abord des fichiers de litiges pour les visualiser.</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#15431F' }}
          >
            <FileText className="w-4 h-4" />
            Importer des fichiers
          </Link>
        </div>
      </div>
    )
  }

  const allDisputes: Dispute[] = processedData.reports.flatMap(r => r.disputes)

  const filteredDisputes = allDisputes.filter(d => {
    if (companyFilter !== 'all' && d.company !== companyFilter) return false
    if (transporterFilter !== 'all' && d.transporter !== transporterFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    return true
  })

  const totalAmount = filteredDisputes.reduce((sum, d) => sum + d.amount, 0)
  const uniqueStatuses = [...new Set(allDisputes.map(d => d.status))]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Litiges</h1>
        <p className="text-gray-500 text-sm">
          {allDisputes.length} litige(s) au total — {totalAmount.toFixed(2)} € en jeu
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-orange-600">{allDisputes.length}</div>
          <div className="text-sm text-gray-500 mt-1">Total litiges</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{totalAmount.toFixed(2)} €</div>
          <div className="text-sm text-gray-500 mt-1">Montant total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold" style={{ color: '#15431F' }}>
            {allDisputes.filter(d => d.company === 'duhalle').length}
          </div>
          <div className="text-sm text-gray-500 mt-1">Duhallé Boutique</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold" style={{ color: '#1F4A26' }}>
            {allDisputes.filter(d => d.company === 'jocondienne').length}
          </div>
          <div className="text-sm text-gray-500 mt-1">La Jocondienne</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Entreprise</label>
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Toutes</option>
              <option value="duhalle">{COMPANY_LABELS.duhalle}</option>
              <option value="jocondienne">{COMPANY_LABELS.jocondienne}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Transporteur</label>
            <select
              value={transporterFilter}
              onChange={e => setTransporterFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Tous</option>
              <option value="colissimo">{TRANSPORTER_LABELS.colissimo}</option>
              <option value="dpd">{TRANSPORTER_LABELS.dpd}</option>
              <option value="geodis">{TRANSPORTER_LABELS.geodis}</option>
            </select>
          </div>
          {uniqueStatuses.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Statut</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Tous</option>
                {uniqueStatuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div className="ml-auto text-sm text-gray-500 self-center">
            {filteredDisputes.length} litige(s) affiché(s)
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <DisputesTable disputes={filteredDisputes} />
      </div>
    </div>
  )
}

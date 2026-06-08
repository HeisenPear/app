'use client'

import { useState } from 'react'
import type { Dispute } from '@/lib/types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DisputesTableProps {
  disputes: Dispute[]
  pageSize?: number
}

function formatDate(date: string): string {
  if (!date) return '—'
  const parts = date.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return date
}

function getStatusVariant(status: string): { bg: string; text: string } {
  const lower = status.toLowerCase()
  if (lower.includes('régl') || lower.includes('clos') || lower.includes('résol')) {
    return { bg: 'bg-green-100', text: 'text-green-700' }
  }
  if (lower.includes('cours') || lower.includes('pend') || lower.includes('open')) {
    return { bg: 'bg-orange-100', text: 'text-orange-700' }
  }
  if (lower.includes('refus') || lower.includes('rejet')) {
    return { bg: 'bg-red-100', text: 'text-red-700' }
  }
  return { bg: 'bg-gray-100', text: 'text-gray-600' }
}

export default function DisputesTable({ disputes, pageSize = 50 }: DisputesTableProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = search
    ? disputes.filter(
        d =>
          d.orderRef.toLowerCase().includes(search.toLowerCase()) ||
          d.type.toLowerCase().includes(search.toLowerCase()) ||
          d.status.toLowerCase().includes(search.toLowerCase())
      )
    : disputes

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pageDisputes = filtered.slice(start, start + pageSize)

  return (
    <div>
      {/* Search */}
      <div className="p-4 border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher par N° commande, type ou statut..."
          className="w-full max-w-sm text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
        />
        {search && (
          <div className="text-xs text-gray-500 mt-1.5">
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-orange-700">
              {['N° Commande', 'Entreprise', 'Transporteur', 'Date', 'Type', 'Montant', 'Statut', 'Description'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageDisputes.map((dispute, idx) => {
              const isOdd = idx % 2 !== 0
              const { bg, text } = getStatusVariant(dispute.status)

              return (
                <tr key={`${dispute.orderRef}-${idx}`} className={isOdd ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{dispute.orderRef}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{COMPANY_LABELS[dispute.company]}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{TRANSPORTER_LABELS[dispute.transporter]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(dispute.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{dispute.type}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {dispute.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={dispute.description}>
                    {dispute.description || '—'}
                  </td>
                </tr>
              )
            })}
            {pageDisputes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  Aucun litige trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {start + 1}–{Math.min(start + pageSize, filtered.length)} sur {filtered.length} litiges
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

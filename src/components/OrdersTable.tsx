'use client'

import { useState } from 'react'
import type { Order } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface OrdersTableProps {
  orders: Order[]
  pageSize?: number
}

function formatDate(date: string): string {
  if (!date) return '—'
  const parts = date.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return date
}

export default function OrdersTable({ orders, pageSize = 50 }: OrdersTableProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = search
    ? orders.filter(
        o =>
          o.id.toLowerCase().includes(search.toLowerCase()) ||
          o.deliveryMode.toLowerCase().includes(search.toLowerCase())
      )
    : orders

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pageOrders = filtered.slice(start, start + pageSize)

  return (
    <div>
      {/* Search */}
      <div className="p-4 border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher par N° commande ou mode de livraison..."
          className="w-full max-w-sm text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
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
            <tr style={{ backgroundColor: '#15431F' }}>
              {['N° Commande', 'Date', 'Mode de livraison', 'Total TTC', 'Frais de port', 'Statut'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageOrders.map((order, idx) => {
              const isFree = order.shippingCost === 0
              const isOdd = idx % 2 !== 0

              return (
                <tr
                  key={`${order.id}-${idx}`}
                  className={isFree ? 'bg-blue-50' : isOdd ? 'bg-gray-50' : 'bg-white'}
                >
                  <td className={`px-4 py-3 text-sm ${isFree ? 'font-semibold text-blue-800' : 'text-gray-800'}`}>
                    {order.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(order.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={order.deliveryMode}>
                    {order.deliveryMode}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {order.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${isFree ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
                    {order.shippingCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isFree ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {isFree ? '🟢 Offerts' : '🔵 Payants'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {pageOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  Aucune commande trouvée
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
            {start + 1}–{Math.min(start + pageSize, filtered.length)} sur {filtered.length} commandes
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

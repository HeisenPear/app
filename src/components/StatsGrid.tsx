import type { ShippingStats } from '@/lib/types'
import { Package, TrendingDown, TrendingUp, Euro } from 'lucide-react'

interface StatsGridProps {
  stats: ShippingStats
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const freePercent = stats.totalOrders > 0
    ? ((stats.freeShippingOrders / stats.totalOrders) * 100).toFixed(1)
    : '0'

  const paidPercent = stats.totalOrders > 0
    ? ((stats.paidShippingOrders / stats.totalOrders) * 100).toFixed(1)
    : '0'

  const avgShipping = stats.paidShippingOrders > 0
    ? (stats.totalShippingCost / stats.paidShippingOrders).toFixed(2)
    : '0.00'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D4E8D6' }}>
            <Package className="w-5 h-5" style={{ color: '#15431F' }} />
          </div>
          <span className="text-sm font-medium text-gray-600">Total commandes</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats.totalOrders.toLocaleString('fr-FR')}</div>
      </div>

      {/* Free shipping */}
      <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50">
            <TrendingDown className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Ports offerts</span>
        </div>
        <div className="text-2xl font-bold text-blue-600">{stats.freeShippingOrders.toLocaleString('fr-FR')}</div>
        <div className="text-xs text-gray-500 mt-1">{freePercent}% du total</div>
      </div>

      {/* Paid shipping */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100">
            <TrendingUp className="w-5 h-5 text-gray-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Ports payants</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats.paidShippingOrders.toLocaleString('fr-FR')}</div>
        <div className="text-xs text-gray-500 mt-1">{paidPercent}% du total</div>
      </div>

      {/* Total cost */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50">
            <Euro className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">Coût total port</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {stats.totalShippingCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div className="text-xs text-gray-500 mt-1">Moy. {avgShipping} € / cmd payante</div>
      </div>
    </div>
  )
}

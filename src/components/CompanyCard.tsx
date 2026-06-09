import type { CompanyReport, Company } from '@/lib/types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '@/lib/types'
import { Package, TrendingDown, Euro, AlertTriangle } from 'lucide-react'

interface CompanyCardProps {
  company: Company
  reports: CompanyReport[]
}

const TRANSPORTER_COLORS: Record<string, string> = {
  colissimo: '#15431F',
  dpd: '#7B1A1A',
  geodis: '#0D3B6E',
  retrait: '#7A4A12',
}

export default function CompanyCard({ company, reports }: CompanyCardProps) {
  const label = COMPANY_LABELS[company]
  const initials = company === 'duhalle' ? 'DB' : 'LJ'

  const totalOrders = reports.reduce((sum, r) => sum + r.stats.totalOrders, 0)
  const totalFree = reports.reduce((sum, r) => sum + r.stats.freeShippingOrders, 0)
  const totalCost = reports.reduce((sum, r) => sum + r.stats.totalShippingCost, 0)
  const totalDisputes = reports.reduce((sum, r) => sum + r.disputes.length, 0)

  const freePercent = totalOrders > 0 ? ((totalFree / totalOrders) * 100).toFixed(1) : '0'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: '#F0F8F1' }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: '#15431F' }}
        >
          {initials}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <p className="text-xs text-gray-500">{reports.length} transporteur{reports.length > 1 ? 's' : ''}</p>
        </div>
        {totalDisputes > 0 && (
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            {totalDisputes} litige{totalDisputes > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="p-5 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Package className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{totalOrders}</div>
          <div className="text-xs text-gray-500">Commandes</div>
        </div>
        <div className="text-center border-x border-gray-100">
          <div className="flex items-center justify-center mb-1">
            <TrendingDown className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-600">{freePercent}%</div>
          <div className="text-xs text-gray-500">Ports offerts</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Euro className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">
            {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
          </div>
          <div className="text-xs text-gray-500">Coût total</div>
        </div>
      </div>

      {/* Per-transporter breakdown */}
      {reports.length > 1 && (
        <div className="px-5 pb-5 space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Par transporteur</div>
          {reports.map(report => {
            const color = TRANSPORTER_COLORS[report.transporter] || '#15431F'
            const pct = report.stats.totalOrders > 0
              ? ((report.stats.freeShippingOrders / report.stats.totalOrders) * 100).toFixed(0)
              : '0'
            return (
              <div key={report.transporter} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-700 w-20 flex-shrink-0">
                  {TRANSPORTER_LABELS[report.transporter]}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-10 text-right">
                  {report.stats.totalOrders} cmd
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

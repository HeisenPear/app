import type { CompanyReport } from '@/lib/types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '@/lib/types'
import { RATE_LABELS, RATE_STATUS } from '@/lib/constants'

interface TransporterStatsProps {
  report: CompanyReport
}

export default function TransporterStats({ report }: TransporterStatsProps) {
  const { stats } = report
  const colors = getTransporterColors(report.transporter)

  const freePercent = stats.totalOrders > 0
    ? ((stats.freeShippingOrders / stats.totalOrders) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: colors.accent }}>
          <h3 className="font-semibold" style={{ color: colors.primary }}>
            {COMPANY_LABELS[report.company]} — {TRANSPORTER_LABELS[report.transporter]}
          </h3>
          {report.period && (
            <p className="text-sm mt-0.5" style={{ color: colors.primary, opacity: 0.7 }}>
              Période : {report.period}
            </p>
          )}
        </div>

        {/* Key indicators */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-500">Total commandes</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Ports offerts</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {stats.freeShippingOrders}
              <span className="text-sm font-normal text-gray-400 ml-1">({freePercent}%)</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Ports payants</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.paidShippingOrders}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Coût total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {stats.totalShippingCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          </div>
        </div>
      </div>

      {/* Distribution table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: colors.accent }}>
          <h3 className="font-semibold" style={{ color: colors.primary }}>
            Distribution des frais de port
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: colors.primary }}>
                {['Frais de port', 'Nb commandes', '% du total', 'Sous-total', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.distribution.map((entry, idx) => {
                const isFree = entry.rate === 0
                const bgClass = isFree ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                const textColor = isFree ? 'text-blue-700 font-semibold' : 'text-gray-700'

                return (
                  <tr key={entry.rate} className={bgClass}>
                    <td className={`px-4 py-3 text-sm ${textColor}`}>
                      {RATE_LABELS[entry.rate] || `${entry.rate} €`}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center ${textColor}`}>
                      {entry.count}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {stats.totalOrders > 0 ? ((entry.count / stats.totalOrders) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-700">
                      {entry.subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                    <td className={`px-4 py-3 text-sm ${textColor}`}>
                      {RATE_STATUS[entry.rate] || '🔵 Payants'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: colors.primary }}>
                <td className="px-4 py-3 text-sm font-bold text-white">TOTAL</td>
                <td className="px-4 py-3 text-sm font-bold text-white text-center">{stats.totalOrders}</td>
                <td className="px-4 py-3 text-sm font-bold text-white text-center">100%</td>
                <td className="px-4 py-3 text-sm font-bold text-white text-center">
                  {stats.totalShippingCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td className="px-4 py-3 text-sm text-white"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Progress bars */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Répartition visuelle</h3>
        <div className="space-y-3">
          {stats.distribution.filter(d => d.count > 0).map(entry => {
            const pct = stats.totalOrders > 0 ? (entry.count / stats.totalOrders) * 100 : 0
            const isFree = entry.rate === 0
            return (
              <div key={entry.rate} className="flex items-center gap-3">
                <div className="w-16 text-sm text-gray-600 text-right flex-shrink-0">
                  {RATE_LABELS[entry.rate] || `${entry.rate} €`}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                  <div
                    className="h-4 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isFree ? '#1565C0' : colors.primary,
                    }}
                  />
                </div>
                <div className="w-24 text-sm text-gray-600 flex-shrink-0">
                  {entry.count} cmd ({pct.toFixed(1)}%)
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getTransporterColors(transporter: string) {
  switch (transporter) {
    case 'dpd':
      return { primary: '#7B1A1A', secondary: '#8B2020', accent: '#F5D5D5' }
    case 'geodis':
      return { primary: '#0D3B6E', secondary: '#0D47A1', accent: '#DAEAF8' }
    default:
      return { primary: '#15431F', secondary: '#1F4A26', accent: '#D4E8D6' }
  }
}

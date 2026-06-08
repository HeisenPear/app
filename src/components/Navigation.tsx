'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Upload, FileText, AlertTriangle, BarChart2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Tableau de bord', icon: BarChart2 },
  { href: '/upload', label: 'Importer', icon: Upload },
  { href: '/rapports', label: 'Rapports', icon: FileText },
  { href: '/litiges', label: 'Litiges', icon: AlertTriangle },
]

export default function Navigation() {
  const pathname = usePathname()
  const { processedData } = useAppStore()

  const disputeCount = processedData?.reports.reduce((sum, r) => sum + r.disputes.length, 0) || 0

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-gray-900">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#15431F' }}
            >
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:block text-sm font-semibold text-gray-900">
              Frais de Port
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href
              const hasCount = href === '/litiges' && disputeCount > 0

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative',
                    isActive
                      ? 'text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                  style={isActive ? { backgroundColor: '#15431F' } : {}}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:block">{label}</span>
                  {hasCount && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                      {disputeCount > 9 ? '9+' : disputeCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Status indicator */}
          {processedData && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border" style={{ borderColor: '#D4E8D6', backgroundColor: '#F0F8F1', color: '#15431F' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              {processedData.globalStats.totalOrders} commandes
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

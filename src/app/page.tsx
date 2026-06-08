'use client'

import Link from 'next/link'
import { Upload, FileText, AlertTriangle, Package, TrendingUp, Euro } from 'lucide-react'
import { useAppStore } from '@/store'
import StatsGrid from '@/components/StatsGrid'
import CompanyCard from '@/components/CompanyCard'

export default function DashboardPage() {
  const { processedData } = useAppStore()

  const hasData = processedData !== null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#15431F' }}>
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
            <p className="text-sm text-gray-500">Analyse des frais de port et litiges transporteurs</p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="space-y-8">
          {/* Welcome card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#D4E8D6' }}>
              <Upload className="w-8 h-8" style={{ color: '#15431F' }} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune donnée chargée</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Commencez par importer vos fichiers de commandes et litiges pour voir les statistiques et générer vos rapports Excel.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: '#15431F' }}
              >
                <Upload className="w-4 h-4" />
                Importer des fichiers
              </Link>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: '#D4E8D6' }}>
                <Upload className="w-5 h-5" style={{ color: '#15431F' }} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Import multi-formats</h3>
              <p className="text-sm text-gray-500">
                CSV, Excel (XLSX), PDF et ZIP. Détection automatique du transporteur et du type de fichier.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: '#D4E8D6' }}>
                <TrendingUp className="w-5 h-5" style={{ color: '#15431F' }} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Analyse détaillée</h3>
              <p className="text-sm text-gray-500">
                Distribution des frais de port, statistiques par transporteur, suivi des litiges en temps réel.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: '#D4E8D6' }}>
                <FileText className="w-5 h-5" style={{ color: '#15431F' }} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Export Excel formaté</h3>
              <p className="text-sm text-gray-500">
                Génération de rapports Excel avec mise en forme professionnelle, couleurs et formules.
              </p>
            </div>
          </div>

          {/* Companies */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Entreprises suivies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 bg-gray-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#15431F' }}>
                  DB
                </div>
                <div>
                  <div className="font-medium text-gray-900">Duhallé Boutique</div>
                  <div className="text-sm text-gray-500">Colissimo · DPD · GEODIS</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 bg-gray-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#1F4A26' }}>
                  LJ
                </div>
                <div>
                  <div className="font-medium text-gray-900">La Jocondienne</div>
                  <div className="text-sm text-gray-500">Colissimo · DPD · GEODIS</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Global stats */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Indicateurs globaux</h2>
            <StatsGrid stats={processedData.globalStats} />
          </div>

          {/* Quick actions */}
          <div className="flex gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Ajouter des fichiers
            </Link>
            <Link
              href="/rapports"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#15431F' }}
            >
              <FileText className="w-4 h-4" />
              Voir les rapports
            </Link>
            <Link
              href="/litiges"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-orange-50 transition-colors"
              style={{ borderColor: '#F59E0B', color: '#D97706' }}
            >
              <AlertTriangle className="w-4 h-4" />
              Litiges ({processedData.reports.reduce((sum, r) => sum + r.disputes.length, 0)})
            </Link>
          </div>

          {/* Company cards */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Par entreprise</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['duhalle', 'jocondienne'].map((company) => {
                const companyReports = processedData.reports.filter(r => r.company === company)
                if (companyReports.length === 0) return null
                return (
                  <CompanyCard
                    key={company}
                    company={company as 'duhalle' | 'jocondienne'}
                    reports={companyReports}
                  />
                )
              })}
            </div>
          </div>

          {/* Totals summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé financier</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: '#15431F' }}>
                  {processedData.globalStats.totalOrders}
                </div>
                <div className="text-sm text-gray-500 mt-1">Commandes totales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {processedData.globalStats.freeShippingOrders}
                </div>
                <div className="text-sm text-gray-500 mt-1">Ports offerts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {processedData.globalStats.totalShippingCost.toFixed(2)} €
                </div>
                <div className="text-sm text-gray-500 mt-1">Coût total port</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {processedData.reports.reduce((sum, r) => sum + r.disputes.length, 0)}
                </div>
                <div className="text-sm text-gray-500 mt-1">Litiges en cours</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

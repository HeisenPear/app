'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  Trash2,
  Eye,
  Loader2,
  Database,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { COMPANY_LABELS } from '@/lib/types'
import type { BatchSummary, BatchRecord, Company } from '@/lib/types'

export default function HistoriquePage() {
  const router = useRouter()
  const { setProcessedData } = useAppStore()

  const [configured, setConfigured] = useState(true)
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedRecord, setExpandedRecord] = useState<BatchRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/batches')
      const data = await res.json()
      setConfigured(data.configured !== false)
      setBatches(data.batches || [])
      if (data.error) setError(data.error)
    } catch {
      setError('Impossible de charger l’historique.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleView = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/batches/${id}`)
      if (!res.ok) throw new Error()
      const record: BatchRecord = await res.json()
      setProcessedData(record.data)
      router.push('/rapports')
    } catch {
      setError('Impossible d’ouvrir ce rapport.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement ce lot (fichiers + rapport) ?')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setBatches((prev) => prev.filter((b) => b.id !== id))
      if (expanded === id) setExpanded(null)
    } catch {
      setError('Suppression impossible.')
    } finally {
      setBusyId(null)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null)
      setExpandedRecord(null)
      return
    }
    setExpanded(id)
    setExpandedRecord(null)
    try {
      const res = await fetch(`/api/batches/${id}`)
      if (res.ok) setExpandedRecord(await res.json())
    } catch {
      /* ignore */
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Historique</h1>
        <p className="text-gray-500">
          Lots enregistrés (fichiers d’origine + rapport calculé), partagés par toute l’équipe.
        </p>
      </div>

      {!configured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
          <Database className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-amber-800">Stockage partagé non configuré</div>
            <p className="text-amber-700 mt-1">
              Pour activer la mémoire partagée, créez un store <strong>Vercel Blob</strong> dans
              l’onglet <em>Storage</em> de votre projet Vercel, puis redéployez. La variable
              <code className="mx-1 px-1 bg-amber-100 rounded">BLOB_READ_WRITE_TOKEN</code>
              est ajoutée automatiquement.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement…
        </div>
      ) : batches.length === 0 && configured ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun lot enregistré pour le moment.</p>
          <button
            onClick={() => router.push('/upload')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#15431F' }}
          >
            <Download className="w-4 h-4 rotate-180" />
            Importer des fichiers
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{b.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatDate(b.createdAt)}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {b.companies.map((c: Company) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: '#F0F8F1', color: '#15431F' }}
                      >
                        {COMPANY_LABELS[c]}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {b.totalOrders} commandes
                    </span>
                    {b.totalDisputes > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        {b.totalDisputes} litiges
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {b.fileCount} fichier{b.fileCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleView(b.id)}
                    disabled={busyId === b.id}
                    title="Voir le rapport"
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {busyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <a
                    href={`/api/batches/${b.id}/export`}
                    title="Exporter Excel"
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => toggleExpand(b.id)}
                    title="Fichiers d’origine"
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  >
                    {expanded === b.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={busyId === b.id}
                    title="Supprimer"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expanded === b.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
                  <div className="text-xs font-medium text-gray-500 mb-2">Fichiers d’origine</div>
                  {expandedRecord ? (
                    <div className="space-y-1.5">
                      {expandedRecord.sources.map((s) => (
                        <a
                          key={s.pathname}
                          href={`/api/batches/${b.id}/source?path=${encodeURIComponent(s.pathname)}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                        >
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="truncate">{s.name}</span>
                          <span className="text-xs text-gray-400">
                            ({(s.size / 1024).toFixed(0)} Ko)
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

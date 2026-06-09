'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { useAppStore } from '@/store'
import FileDropZone from '@/components/FileDropZone'
import { calculateStats } from '@/lib/processors/stats'
import type { UploadedFile, Order, Dispute, Company, Transporter, ProcessedData, CompanyReport } from '@/lib/types'

/** Files larger than this are extracted client-side if they are ZIPs. */
const MAX_DIRECT_BYTES = 4 * 1024 * 1024 // 4 MB

function resolvePeriod(orders: Order[]): string {
  if (orders.length === 0) return ''
  const dates = orders.map(o => o.date).filter(Boolean).sort()
  if (!dates.length) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  return first === last ? first : `${first} — ${last}`
}

function mergeResults(results: Array<ProcessedData & { errors?: string[] }>): {
  merged: ProcessedData
  errors: string[]
} {
  const errors: string[] = []
  const groupMap = new Map<string, { orders: Order[]; disputes: Dispute[] }>()

  for (const result of results) {
    if (result.errors?.length) errors.push(...result.errors)
    for (const report of result.reports) {
      const key = `${report.company}:${report.transporter}`
      const entry = groupMap.get(key) ?? { orders: [], disputes: [] }
      entry.orders.push(...report.orders)
      entry.disputes.push(...report.disputes)
      groupMap.set(key, entry)
    }
  }

  const reports: CompanyReport[] = Array.from(groupMap.entries()).map(([key, { orders, disputes }]) => {
    const [company, transporter] = key.split(':') as [Company, Transporter]
    return { company, transporter, period: resolvePeriod(orders), orders, disputes, stats: calculateStats(orders) }
  })

  const allOrders = reports.flatMap(r => r.orders)
  return {
    merged: { reports, globalStats: calculateStats(allOrders), processedAt: new Date().toISOString() },
    errors,
  }
}

/**
 * Expand a single UploadedFile into one or more sendable units.
 *
 * Large ZIP files are extracted client-side so that each contained file is
 * sent as a separate request — keeping every request under Vercel's 4.5 MB
 * serverless-function body limit, regardless of the archive's total size.
 */
async function expandUploadedFile(uf: UploadedFile): Promise<UploadedFile[]> {
  const ext = uf.file.name.toLowerCase().split('.').pop()

  if (uf.file.size <= MAX_DIRECT_BYTES || ext !== 'zip') {
    return [uf]
  }

  // Extract ZIP in the browser and emit one entry per contained file.
  // Use uint8array (not blob) for reliable binary extraction of PDFs.
  const arrayBuffer = await uf.file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const results: UploadedFile[] = []

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const base = path.split('/').pop() || path
    if (path.startsWith('__MACOSX/') || base.startsWith('._') || base === '.DS_Store') continue

    const lower = base.toLowerCase()
    const fileExt = lower.split('.').pop() ?? ''
    if (!['csv', 'xlsx', 'xls', 'pdf'].includes(fileExt)) continue

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    }

    const uint8 = await entry.async('uint8array')
    const file = new File([uint8], base, { type: mimeTypes[fileExt] ?? 'application/octet-stream' })

    // Mirror the transporter-from-filename logic used by the server-side ZIP parser
    let fileTransporter = uf.transporter
    if (!fileTransporter) {
      if (lower.includes('colissimo') || lower.includes('colis')) fileTransporter = 'colissimo'
      else if (lower.includes('dpd')) fileTransporter = 'dpd'
      else if (lower.includes('geodis') || lower.includes('geo')) fileTransporter = 'geodis'
    }

    results.push({ id: `${uf.id}-${base}`, file, company: uf.company, fileType: uf.fileType, transporter: fileTransporter, status: 'pending' })
  }

  return results
}

export default function UploadPage() {
  const router = useRouter()
  const { setProcessedData, setIsProcessing, setIsExporting, isProcessing, isExporting, processedData } = useAppStore()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [processError, setProcessError] = useState<string | null>(null)
  const [processWarnings, setProcessWarnings] = useState<string[]>([])
  const [processSuccess, setProcessSuccess] = useState(false)
  const [persist, setPersist] = useState(true)
  const [label, setLabel] = useState('')
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const [persistWarning, setPersistWarning] = useState<string | null>(null)

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files)
    setProcessSuccess(false)
    setProcessError(null)
    setProcessWarnings([])
    setSavedLabel(null)
    setPersistWarning(null)
  }

  const handleProcess = async () => {
    if (uploadedFiles.length === 0) return

    setIsProcessing(true)
    setProcessError(null)
    setProcessWarnings([])
    setProcessSuccess(false)
    setSavedLabel(null)
    setPersistWarning(null)

    try {
      // Expand large ZIPs client-side so every server request stays under 4.5 MB.
      const expandedFiles: UploadedFile[] = []
      for (const uf of uploadedFiles) {
        const expanded = await expandUploadedFile(uf)
        expandedFiles.push(...expanded)
      }

      const fileResults: Array<ProcessedData & { errors?: string[] }> = []
      // Hard errors: request/network failures
      const fileErrors: string[] = []
      // Soft warnings: parse issues (no text, unknown format, …)
      const parseWarnings: string[] = []

      for (const uf of expandedFiles) {
        const formData = new FormData()
        formData.append('files', uf.file)
        formData.append(`company_${uf.file.name}`, uf.company)
        formData.append(`fileType_${uf.file.name}`, uf.fileType)
        if (uf.transporter) formData.append(`transporter_${uf.file.name}`, uf.transporter)

        const response = await fetch('/api/process', { method: 'POST', body: formData })
        const data = await readJsonResponse(response)

        if (!response.ok) {
          const msg =
            data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
              ? (data as { error: string }).error
              : `Erreur HTTP ${response.status}`
          fileErrors.push(`[${uf.file.name}] : ${msg}`)
        } else {
          const result = data as ProcessedData & { errors?: string[] }
          if (result.errors?.length) {
            parseWarnings.push(...result.errors.map(e => `[${uf.file.name}] ${e}`))
          }
          fileResults.push(result)
        }
      }

      if (fileResults.length === 0) {
        throw new Error(fileErrors.join('\n') || 'Aucun fichier traité avec succès.')
      }

      const { merged, errors: mergeWarnings } = mergeResults(fileResults)
      const allWarnings = [...parseWarnings, ...mergeWarnings, ...fileErrors]

      setProcessedData(merged)
      setProcessSuccess(true)
      if (allWarnings.length) setProcessWarnings(allWarnings)

      // Persist the merged result if requested
      if (persist) {
        const saveRes = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: merged, label: label.trim() || undefined }),
        })
        const saved = await readJsonResponse(saveRes)
        if (saved && typeof saved === 'object') {
          const s = saved as { batch?: { label: string }; error?: string }
          if (s.batch) setSavedLabel(s.batch.label)
          else if (s.error) setPersistWarning(s.error)
        }
      }
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExport = async () => {
    if (!processedData) return

    setIsExporting(true)
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedData),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération Excel')
      }

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
      setProcessError(err instanceof Error ? err.message : 'Erreur export')
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Safely parse a fetch Response that is expected to be JSON. Serverless
   * platforms (e.g. Vercel) return HTML error pages on crashes/timeouts/limits,
   * which would otherwise throw an opaque "Unexpected token '<'" error.
   */
  async function readJsonResponse(response: Response): Promise<unknown> {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      return {
        error: snippet
          ? `Réponse inattendue du serveur : ${snippet}`
          : `Le serveur a renvoyé une réponse vide (HTTP ${response.status}).`,
      }
    }
  }

  const pendingCount = uploadedFiles.filter(f => f.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Importer des fichiers</h1>
        <p className="text-gray-500">
          Importez vos fichiers de commandes et de litiges (CSV, XLSX, PDF, ZIP)
        </p>
      </div>

      {/* Drop zone */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <FileDropZone files={uploadedFiles} onFilesChange={handleFilesChange} />
      </div>

      {/* Save options */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
          />
          <span className="text-sm font-medium text-gray-900">
            Enregistrer dans l’historique partagé (fichiers + rapport)
          </span>
        </label>
        {persist && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nom du lot (optionnel)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : Colissimo — mai 2026"
              className="w-full max-w-sm text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Status messages */}
      {processError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-red-800">Erreur de traitement</div>
            <div className="text-sm text-red-700 mt-1">{processError}</div>
          </div>
        </div>
      )}

      {processSuccess && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-green-800">Traitement réussi</div>
            <div className="text-sm text-green-700 mt-1">
              {processedData?.reports.reduce((sum, r) => sum + r.orders.length, 0)} commandes traitées.
              Vous pouvez maintenant exporter le rapport Excel ou consulter le tableau de bord.
            </div>
            {savedLabel && (
              <div className="text-sm text-green-700 mt-1">
                Enregistré dans l’historique sous «&nbsp;{savedLabel}&nbsp;».{' '}
                <button onClick={() => router.push('/historique')} className="underline font-medium">
                  Voir l’historique
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {processWarnings.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800">
              {processWarnings.length} fichier{processWarnings.length > 1 ? 's' : ''} avec avertissement
            </div>
            <ul className="text-sm text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
              {processWarnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
              {processWarnings.length > 10 && (
                <li>…et {processWarnings.length - 10} autres</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {persistWarning && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">{persistWarning}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleProcess}
          disabled={pendingCount === 0 || isProcessing}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: '#15431F' }}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Traitement en cours...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Traiter {pendingCount > 0 ? `(${pendingCount} fichier${pendingCount > 1 ? 's' : ''})` : 'les fichiers'}
            </>
          )}
        </button>

        {processedData && (
          <>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 font-medium disabled:opacity-50 transition-colors hover:bg-green-50"
              style={{ borderColor: '#15431F', color: '#15431F' }}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Export en cours...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Exporter Excel
                </>
              )}
            </button>

            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Voir le tableau de bord
            </button>
          </>
        )}
      </div>

      {/* Format info */}
      <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-3">Formats supportés</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { ext: 'CSV', desc: 'Export Colissimo, DPD, GEODIS' },
            { ext: 'XLSX', desc: 'Excel commandes et litiges' },
            { ext: 'PDF', desc: 'Bordereaux transporteur' },
            { ext: 'ZIP', desc: 'Archive multi-fichiers' },
          ].map(({ ext, desc }) => (
            <div key={ext} className="flex items-start gap-2">
              <div className="px-2 py-0.5 rounded text-xs font-mono font-bold text-white flex-shrink-0 mt-0.5" style={{ backgroundColor: '#1F4A26' }}>
                {ext}
              </div>
              <span className="text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

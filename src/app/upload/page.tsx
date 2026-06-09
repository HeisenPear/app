'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store'
import FileDropZone from '@/components/FileDropZone'
import { Progress } from '@/components/ui/progress'
import type { ProgressInfo } from '@/lib/client/processFiles'
import type { UploadedFile } from '@/lib/types'

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
  const [progress, setProgress] = useState<ProgressInfo | null>(null)

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
    setProgress({ phase: 'extracting', current: '', done: 0, total: 0 })

    try {
      // All parsing happens locally in the browser — no file ever leaves the
      // machine until we have the small final JSON report. This sidesteps every
      // serverless limit (4.5 MB body, timeouts, memory) so archives of tens of
      // MB / hundreds of invoices process reliably. The heavy parsing libs are
      // lazy-loaded here so they only download when processing actually starts.
      const { processFilesLocally } = await import('@/lib/client/processFiles')
      const { data, warnings } = await processFilesLocally(uploadedFiles, setProgress)

      const totalOrders = data.reports.reduce((sum, r) => sum + r.orders.length, 0)
      if (totalOrders === 0 && data.reports.length === 0) {
        throw new Error(
          warnings.length
            ? `Aucune donnée exploitable.\n${warnings.slice(0, 5).join('\n')}`
            : 'Aucune donnée exploitable trouvée dans les fichiers.'
        )
      }

      setProcessedData(data)
      setProcessSuccess(true)
      if (warnings.length) setProcessWarnings(warnings)

      // Persist only the computed report (small JSON) to shared history.
      if (persist) {
        const saveRes = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, label: label.trim() || undefined }),
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
      setProgress(null)
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

      {/* Live progress (local processing) */}
      {isProcessing && progress && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">
              {progress.phase === 'extracting' && 'Décompression de l’archive…'}
              {progress.phase === 'parsing' && 'Analyse des fichiers (en local)…'}
              {progress.phase === 'ocr' && 'Lecture OCR des PDF image (en local)…'}
              {progress.phase === 'finalizing' && 'Calcul des statistiques…'}
            </span>
            {progress.total > 0 && (
              <span className="text-sm text-gray-500">
                {progress.done} / {progress.total}
              </span>
            )}
          </div>
          <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 10} />
          {progress.current && (
            <div className="text-xs text-gray-400 mt-2 truncate">{progress.current}</div>
          )}
        </div>
      )}

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

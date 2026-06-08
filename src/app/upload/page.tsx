'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store'
import FileDropZone from '@/components/FileDropZone'
import type { UploadedFile } from '@/lib/types'

export default function UploadPage() {
  const router = useRouter()
  const { setProcessedData, setIsProcessing, setIsExporting, isProcessing, isExporting, processedData } = useAppStore()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [processError, setProcessError] = useState<string | null>(null)
  const [processSuccess, setProcessSuccess] = useState(false)

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files)
    setProcessSuccess(false)
    setProcessError(null)
  }

  const handleProcess = async () => {
    if (uploadedFiles.length === 0) return

    setIsProcessing(true)
    setProcessError(null)
    setProcessSuccess(false)

    try {
      const formData = new FormData()
      for (const uf of uploadedFiles) {
        formData.append('files', uf.file)
        formData.append(`company_${uf.file.name}`, uf.company)
        formData.append(`fileType_${uf.file.name}`, uf.fileType)
        if (uf.transporter) {
          formData.append(`transporter_${uf.file.name}`, uf.transporter)
        }
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur lors du traitement')
      }

      const data = await response.json()
      setProcessedData(data)
      setProcessSuccess(true)
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
          </div>
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

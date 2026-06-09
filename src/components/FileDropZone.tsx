'use client'

import { useCallback, useState } from 'react'
import { Upload, File, X, FileSpreadsheet, FileText, Archive } from 'lucide-react'
import type { UploadedFile, Company, FileType, Transporter } from '@/lib/types'
import { COMPANY_LABELS, TRANSPORTER_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
}

function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'csv') return <FileText className="w-4 h-4 text-green-600" />
  if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-600" />
  if (ext === 'zip') return <Archive className="w-4 h-4 text-purple-600" />
  return <File className="w-4 h-4 text-gray-600" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function FileDropZone({ files, onFilesChange }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles)
      const uploadedFiles: UploadedFile[] = fileArray.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        company: 'duhalle' as Company,
        fileType: guessFileType(file.name),
        transporter: guessTransporter(file.name),
        status: 'pending' as const,
      }))
      onFilesChange([...files, ...uploadedFiles])
    },
    [files, onFilesChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id))
  }

  const updateFile = (id: string, changes: Partial<UploadedFile>) => {
    onFilesChange(files.map((f) => (f.id === id ? { ...f, ...changes } : f)))
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
        )}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.pdf,.zip"
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: isDragging ? '#D4E8D6' : '#F0F8F1' }}
          >
            <Upload className="w-7 h-7" style={{ color: '#15431F' }} />
          </div>
          <div>
            <p className="text-base font-medium text-gray-900">
              {isDragging ? 'Déposez les fichiers ici' : 'Glissez-déposez vos fichiers'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ou <span className="font-medium" style={{ color: '#15431F' }}>cliquez pour sélectionner</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">CSV, XLSX, PDF, ZIP — max 50 Mo</p>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">
            {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
          </div>
          {files.map((uf) => (
            <div
              key={uf.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* File icon + name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(uf.file.name)}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{uf.file.name}</div>
                  <div className="text-xs text-gray-500">{formatFileSize(uf.file.size)}</div>
                </div>
              </div>

              {/* Metadata selectors */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Company */}
                <select
                  value={uf.company}
                  onChange={(e) => updateFile(uf.id, { company: e.target.value as Company })}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="duhalle">{COMPANY_LABELS.duhalle}</option>
                  <option value="jocondienne">{COMPANY_LABELS.jocondienne}</option>
                </select>

                {/* File type */}
                <select
                  value={uf.fileType}
                  onChange={(e) => updateFile(uf.id, { fileType: e.target.value as FileType })}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="commandes">Commandes</option>
                  <option value="litiges">Litiges</option>
                </select>

                {/* Transporter (optional) */}
                <select
                  value={uf.transporter || ''}
                  onChange={(e) => updateFile(uf.id, { transporter: (e.target.value as Transporter) || undefined })}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="">Transporteur auto</option>
                  <option value="colissimo">{TRANSPORTER_LABELS.colissimo}</option>
                  <option value="dpd">{TRANSPORTER_LABELS.dpd}</option>
                  <option value="geodis">{TRANSPORTER_LABELS.geodis}</option>
                  <option value="retrait">{TRANSPORTER_LABELS.retrait}</option>
                </select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {uf.status === 'done' && (
                  <span className="text-xs text-green-600 font-medium">✓ Traité</span>
                )}
                {uf.status === 'error' && (
                  <span className="text-xs text-red-600 font-medium" title={uf.error}>
                    ✗ Erreur
                  </span>
                )}
                {uf.status === 'processing' && (
                  <span className="text-xs text-blue-600 font-medium">⋯ En cours</span>
                )}
              </div>

              {/* Remove */}
              <button
                onClick={() => removeFile(uf.id)}
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function guessFileType(filename: string): FileType {
  const lower = filename.toLowerCase()
  if (lower.includes('litig') || lower.includes('dispute') || lower.includes('reclamation')) {
    return 'litiges'
  }
  return 'commandes'
}

function guessTransporter(filename: string): Transporter | undefined {
  const lower = filename.toLowerCase()
  if (lower.includes('colissimo') || lower.includes('colis')) return 'colissimo'
  if (lower.includes('dpd')) return 'dpd'
  if (lower.includes('geodis') || lower.includes('geo')) return 'geodis'
  return undefined
}

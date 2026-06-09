import { NextRequest, NextResponse } from 'next/server'
import { listBatches, saveBatch, isStorageConfigured } from '@/lib/storage/blob'
import { COMPANY_LABELS } from '@/lib/types'
import type { ProcessedData, CompanyReport } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  if (!isStorageConfigured()) {
    return NextResponse.json({ configured: false, batches: [] })
  }
  try {
    const batches = await listBatches()
    return NextResponse.json({ configured: true, batches })
  } catch (err) {
    return NextResponse.json(
      { configured: true, batches: [], error: err instanceof Error ? err.message : 'Erreur de lecture' },
      { status: 500 }
    )
  }
}

/** Save an already-processed report to shared storage (no file re-upload needed). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { data: ProcessedData; label?: string }
    const { data, label } = body

    if (!data?.reports) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    if (!isStorageConfigured()) {
      return NextResponse.json({
        error: "Stockage partagé non configuré : créez un store Vercel Blob (variable BLOB_READ_WRITE_TOKEN).",
      }, { status: 503 })
    }

    const resolvedLabel = label?.trim() || defaultLabel(data.reports)
    const batch = await saveBatch({ label: resolvedLabel, data, sources: [] })
    return NextResponse.json({ batch })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de sauvegarde' },
      { status: 500 }
    )
  }
}

function defaultLabel(reports: CompanyReport[]): string {
  const companies = Array.from(new Set(reports.map((r) => COMPANY_LABELS[r.company])))
  const stamp = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `${companies.length > 0 ? companies.join(' + ') : 'Import'} — ${stamp}`
}

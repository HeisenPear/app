import { NextRequest, NextResponse } from 'next/server'
import { getBatch, isStorageConfigured } from '@/lib/storage/blob'
import { generateExcel } from '@/lib/exporters/excel'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Stockage non configuré' }, { status: 503 })
  }
  const { id } = await params
  try {
    const batch = await getBatch(id)
    if (!batch) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }
    const buffer = await generateExcel(batch.data)
    const filename = `rapport_${batch.label.replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur export' },
      { status: 500 }
    )
  }
}

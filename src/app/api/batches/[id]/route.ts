import { NextRequest, NextResponse } from 'next/server'
import { getBatch, deleteBatch, isStorageConfigured } from '@/lib/storage/blob'

export const runtime = 'nodejs'

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
    return NextResponse.json(batch)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de lecture' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Stockage non configuré' }, { status: 503 })
  }
  const { id } = await params
  try {
    await deleteBatch(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de suppression' },
      { status: 500 }
    )
  }
}

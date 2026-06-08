import { NextResponse } from 'next/server'
import { listBatches, isStorageConfigured } from '@/lib/storage/blob'

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

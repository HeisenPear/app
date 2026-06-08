import { NextRequest, NextResponse } from 'next/server'
import { getSource, isStorageConfigured } from '@/lib/storage/blob'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Stockage non configuré' }, { status: 503 })
  }
  const { id } = await params
  const pathname = req.nextUrl.searchParams.get('path')
  if (!pathname) {
    return NextResponse.json({ error: 'Paramètre "path" manquant' }, { status: 400 })
  }
  try {
    const source = await getSource(id, pathname)
    if (!source) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }
    return new NextResponse(new Uint8Array(source.buffer), {
      status: 200,
      headers: {
        'Content-Type': source.type,
        'Content-Disposition': `attachment; filename="${source.name}"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de téléchargement' },
      { status: 500 }
    )
  }
}

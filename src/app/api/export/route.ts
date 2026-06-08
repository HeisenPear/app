import { NextRequest, NextResponse } from 'next/server'
import { generateExcel } from '@/lib/exporters/excel'
import type { ProcessedData } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const processedData: ProcessedData = await request.json()

    if (!processedData || !processedData.reports) {
      return NextResponse.json({ error: 'Invalid data provided' }, { status: 400 })
    }

    const buffer = await generateExcel(processedData)

    const filename = `rapport_frais_port_${new Date().toISOString().split('T')[0]}.xlsx`

    const uint8 = new Uint8Array(buffer)
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

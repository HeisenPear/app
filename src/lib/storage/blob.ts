import { put, list, del } from '@vercel/blob'
import type {
  ProcessedData,
  Company,
  BatchRecord,
  BatchSummary,
  StoredSource,
} from '../types'

/**
 * Server-side shared persistence backed by Vercel Blob.
 *
 * Layout (one "batch" = one processing run):
 *   batches/{id}/summary.json          small metadata, used for the history list
 *   batches/{id}/batch.json            full record incl. the computed ProcessedData
 *   batches/{id}/source/{i}_{name}     the original uploaded files (PDF/ZIP/…)
 *
 * Blob URLs are never returned to the client; all access is proxied through the
 * API routes, which hold the read/write token.
 */

const PREFIX = 'batches'

/** True when a Vercel Blob store has been provisioned (token present). */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function assertConfigured(): void {
  if (!isStorageConfigured()) {
    throw new Error(
      "Le stockage partagé n'est pas configuré. Créez un store Vercel Blob et redéployez (variable BLOB_READ_WRITE_TOKEN)."
    )
  }
}

function summaryOf(record: BatchRecord): BatchSummary {
  const companies = Array.from(
    new Set(record.data.reports.map((r) => r.company))
  ) as Company[]
  return {
    id: record.id,
    label: record.label,
    createdAt: record.createdAt,
    companies,
    totalOrders: record.data.globalStats.totalOrders,
    totalDisputes: record.data.reports.reduce((sum, r) => sum + r.disputes.length, 0),
    fileCount: record.sources.length,
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Sanitize a filename for safe use inside a blob pathname. */
function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120)
}

export interface SaveBatchInput {
  label: string
  data: ProcessedData
  sources: Array<{ name: string; type: string; buffer: Buffer }>
}

export async function saveBatch(input: SaveBatchInput): Promise<BatchSummary> {
  assertConfigured()
  const id = newId()
  const createdAt = new Date().toISOString()

  // Store the raw source files
  const storedSources: StoredSource[] = []
  for (let i = 0; i < input.sources.length; i++) {
    const src = input.sources[i]
    const pathname = `${PREFIX}/${id}/source/${i}_${safeName(src.name)}`
    await put(pathname, src.buffer, {
      access: 'public',
      contentType: src.type || 'application/octet-stream',
      addRandomSuffix: false,
    })
    storedSources.push({ name: src.name, size: src.buffer.byteLength, type: src.type, pathname })
  }

  const record: BatchRecord = {
    id,
    label: input.label,
    createdAt,
    sources: storedSources,
    data: input.data,
  }

  await put(`${PREFIX}/${id}/batch.json`, JSON.stringify(record), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })
  await put(`${PREFIX}/${id}/summary.json`, JSON.stringify(summaryOf(record)), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  return summaryOf(record)
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Lecture du stockage échouée (HTTP ${res.status})`)
  return (await res.json()) as T
}

export async function listBatches(): Promise<BatchSummary[]> {
  assertConfigured()
  const { blobs } = await list({ prefix: `${PREFIX}/` })
  const summaryBlobs = blobs.filter((b) => b.pathname.endsWith('/summary.json'))
  const summaries = await Promise.all(
    summaryBlobs.map((b) => fetchJson<BatchSummary>(b.url).catch(() => null))
  )
  return summaries
    .filter((s): s is BatchSummary => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getBatch(id: string): Promise<BatchRecord | null> {
  assertConfigured()
  const { blobs } = await list({ prefix: `${PREFIX}/${id}/` })
  const batchBlob = blobs.find((b) => b.pathname.endsWith('/batch.json'))
  if (!batchBlob) return null
  return fetchJson<BatchRecord>(batchBlob.url)
}

/** Resolve a stored source file's bytes by batch id + pathname. */
export async function getSource(
  id: string,
  pathname: string
): Promise<{ buffer: Buffer; type: string; name: string } | null> {
  assertConfigured()
  if (!pathname.startsWith(`${PREFIX}/${id}/`)) return null
  const { blobs } = await list({ prefix: `${PREFIX}/${id}/source/` })
  const match = blobs.find((b) => b.pathname === pathname)
  if (!match) return null
  const res = await fetch(match.url, { cache: 'no-store' })
  if (!res.ok) return null
  const buffer = Buffer.from(await res.arrayBuffer())
  const name = pathname.split('/').pop()?.replace(/^\d+_/, '') || 'fichier'
  return { buffer, type: res.headers.get('content-type') || 'application/octet-stream', name }
}

export async function deleteBatch(id: string): Promise<void> {
  assertConfigured()
  const { blobs } = await list({ prefix: `${PREFIX}/${id}/` })
  if (blobs.length === 0) return
  await del(blobs.map((b) => b.url))
}

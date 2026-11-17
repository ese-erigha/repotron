import { INDEX_STATUS, type IndexStatus } from 'repotron-domain'

import { getBatches, getRepositories } from '../context.ts'
import { startDeletions } from '../delete-stale-indexes/delete-stale-indexes.ts'

export async function markParsing(indexId: string): Promise<void> {
  await getRepositories().repositoryIndexes.markParsing({ id: indexId, now: Date.now() })
}

export async function markEmbedding(indexId: string, fileCount: number, chunkTotal: number): Promise<void> {
  await getRepositories().repositoryIndexes.markEmbedding({ id: indexId, fileCount, chunkTotal, now: Date.now() })
}

export async function recordChunkProgress(indexId: string, chunkTotal: number): Promise<void> {
  const chunkCount = await getRepositories().sourceChunks.countByIndex(indexId)
  await getRepositories().repositoryIndexes.recordChunkProgress({ id: indexId, chunkCount, chunkTotal, now: Date.now() })
}

export async function markReady(indexId: string, chunkCount: number): Promise<void> {
  await getRepositories().repositoryIndexes.markReady({ id: indexId, chunkCount, now: Date.now() })
}

export async function markFailed(indexId: string, stage: IndexStatus, reason: string): Promise<void> {
  await getRepositories().repositoryIndexes.markFailed({
    id: indexId,
    failedStage: stage,
    failureReason: reason,
    now: Date.now(),
  })
}

export async function markDeleting(indexId: string): Promise<void> {
  await getRepositories().repositoryIndexes.markDeleting({ id: indexId, now: Date.now() })
}

export async function deleteIndexRow(indexId: string): Promise<void> {
  await getRepositories().repositoryIndexes.delete(indexId)
}

export async function deleteBatches(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await getBatches().delete(keys)
}

export async function deleteEarlierIndexes(indexId: string): Promise<void> {
  const current = await getRepositories().repositoryIndexes.get(indexId)
  if (!current) return
  const earlier = await getRepositories().repositoryIndexes.listEarlier({
    repositoryId: current.repositoryId,
    createdAt: current.createdAt,
  })
  await startDeletions(earlier.map((row) => row.id))
}

const REASON_MAX_LENGTH = 200

export function failureReason(error: unknown, stage: IndexStatus): string {
  const message = sanitizeReason(messageOf(error))
  if (message === '') return `Indexing failed at the ${stage} stage.`
  return message.length <= REASON_MAX_LENGTH ? message : message.slice(0, REASON_MAX_LENGTH)
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return ''
}

function sanitizeReason(message: string): string {
  return message.replace(/Bearer\s+\S+/gi, 'Bearer').replace(/ghp_\S+/g, '').trim()
}

export { INDEX_STATUS }

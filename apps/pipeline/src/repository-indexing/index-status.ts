import { INDEX_STATUS, type IndexStatus } from 'repotron-domain'

import { getBatches, getRepositories } from '../context.ts'
import { startDeletions } from '../delete-stale-indexes/delete-stale-indexes.ts'

export async function markParsing(indexId: string): Promise<void> {
  await getRepositories().repositoryIndexes.markParsing({ id: indexId, now: Date.now() })
}

export async function markEmbedding(indexId: string, fileCount: number): Promise<void> {
  await getRepositories().repositoryIndexes.markEmbedding({ id: indexId, fileCount, now: Date.now() })
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

export function failureReason(error: unknown, stage: IndexStatus): string {
  const message = error instanceof Error ? error.message : ''
  if (message !== '' && message.length <= 200 && !message.includes('Bearer') && !message.includes('ghp_')) {
    return message
  }
  return `Indexing failed at the ${stage} stage.`
}

export { INDEX_STATUS }

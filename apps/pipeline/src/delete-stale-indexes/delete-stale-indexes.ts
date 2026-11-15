import { INDEX_RETENTION_DAYS } from 'repotron-domain'

import type { WorkflowStart } from '../bindings.ts'
import { getIndexDeletion, getRepositories } from '../context.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export async function deleteStaleIndexes(now: number): Promise<void> {
  const olderThan = now - INDEX_RETENTION_DAYS * DAY_MS
  const stale = await getRepositories().repositoryIndexes.listStale({ olderThan })
  await startDeletions(stale.map((row) => row.id))
}

export async function startDeletions(indexIds: string[]): Promise<void> {
  if (indexIds.length === 0) return
  const batch = indexIds.map((indexId) => deletionInstance(indexId))
  try {
    await getIndexDeletion().createBatch(batch)
  } catch (error) {
    if (!isExistingInstance(error)) throw error
    await startDeletionsOneByOne(batch)
  }
}

async function startDeletionsOneByOne(batch: WorkflowStart[]): Promise<void> {
  for (const instance of batch) {
    try {
      await getIndexDeletion().create(instance)
    } catch (error) {
      if (!isExistingInstance(error)) throw error
    }
  }
}

function deletionInstance(indexId: string): WorkflowStart {
  return { id: `delete-${indexId}`, params: { indexId } }
}

export function isExistingInstance(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('already exists')
}

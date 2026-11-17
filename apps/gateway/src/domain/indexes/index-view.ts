import type { RepositoryIndexRecord } from 'db'
import { INDEX_STATUS, type IndexView } from 'repotron-domain'

import { getRepositories } from '../../context.ts'

export async function toIndexView(row: RepositoryIndexRecord, repository: { owner: string; name: string }): Promise<IndexView> {
  const fallback =
    row.status === INDEX_STATUS.ready
      ? undefined
      : await getRepositories().repositoryIndexes.findNewestReady({ repositoryId: row.repositoryId, excludeId: row.id })
  return {
    id: row.id,
    repository: { owner: repository.owner, name: repository.name },
    commitSha: row.commitSha,
    status: row.status as IndexView['status'],
    failedStage: (row.failedStage as IndexView['failedStage']) ?? null,
    failureReason: row.failureReason,
    fileCount: row.fileCount,
    chunkCount: row.chunkCount,
    chunkTotal: row.chunkTotal ?? null,
    fallbackIndexId: fallback?.id ?? null,
    createdAt: row.createdAt,
    readyAt: row.readyAt,
  }
}

export function toReadyView(row: RepositoryIndexRecord, repository: { owner: string; name: string }): IndexView {
  return {
    id: row.id,
    repository: { owner: repository.owner, name: repository.name },
    commitSha: row.commitSha,
    status: INDEX_STATUS.ready,
    failedStage: null,
    failureReason: null,
    fileCount: row.fileCount,
    chunkCount: row.chunkCount,
    chunkTotal: row.chunkTotal ?? null,
    fallbackIndexId: null,
    createdAt: row.createdAt,
    readyAt: row.readyAt,
  }
}

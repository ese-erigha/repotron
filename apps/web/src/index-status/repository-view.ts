import { INDEX_STATUS, type IndexView } from 'repotron-domain'

export const REPOSITORY_VIEW = {
  /** The URL holds no index id. */
  START: 'start',
  /** The first status read runs. */
  LOADING: 'loading',
  /** The index does not exist, or the cleanup deletes it. */
  MISSING: 'missing',
  /** The status read failed and no earlier read succeeded. */
  UNAVAILABLE: 'unavailable',
  INDEXING: 'indexing',
  FAILED: 'failed',
  /** A newer commit indexes, and an earlier index answers the questions. */
  REINDEXING: 'reindexing',
  ASK: 'ask',
} as const

export type RepositoryView = (typeof REPOSITORY_VIEW)[keyof typeof REPOSITORY_VIEW]

export type RepositoryViewInput = {
  indexId: string | null
  index: IndexView | null
  isMissing: boolean
  hasError: boolean
}

/** Picks the one view of the repository screen from the URL and the index status. */
export function selectRepositoryView(input: RepositoryViewInput): RepositoryView {
  if (input.indexId === null) return REPOSITORY_VIEW.START
  if (input.isMissing) return REPOSITORY_VIEW.MISSING
  if (input.index === null) return input.hasError ? REPOSITORY_VIEW.UNAVAILABLE : REPOSITORY_VIEW.LOADING
  switch (input.index.status) {
    case INDEX_STATUS.ready:
      return REPOSITORY_VIEW.ASK
    case INDEX_STATUS.failed:
      return REPOSITORY_VIEW.FAILED
    case INDEX_STATUS.deleting:
      return REPOSITORY_VIEW.MISSING
    default:
      return input.index.fallbackIndexId === null ? REPOSITORY_VIEW.INDEXING : REPOSITORY_VIEW.REINDEXING
  }
}

/** The index that answers a question: the ready index, or the earlier one while a newer commit indexes. */
export function activeIndexIdOf(index: IndexView | null): string | null {
  if (index === null) return null
  return index.status === INDEX_STATUS.ready ? index.id : index.fallbackIndexId
}

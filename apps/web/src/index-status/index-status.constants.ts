import { INDEX_RETENTION_DAYS, INDEX_STATUS, STATUS_POLL_MS } from 'repotron-domain'

import type { IndexStage } from './index-stage'

const MILLISECONDS_PER_SECOND = 1_000

export const STAGE_LABEL: Record<IndexStage, string> = {
  [INDEX_STATUS.queued]: 'Queued',
  [INDEX_STATUS.parsing]: 'Parsing',
  [INDEX_STATUS.embedding]: 'Embedding',
  [INDEX_STATUS.ready]: 'Ready',
}

/** One sentence for the stage that runs now. */
export const STAGE_DESCRIPTION: Record<IndexStage, string> = {
  [INDEX_STATUS.queued]: 'The job waits for its turn.',
  [INDEX_STATUS.parsing]: 'Repotron downloads the code and splits it along its functions and classes.',
  [INDEX_STATUS.embedding]: 'Repotron embeds each chunk, so a question can find it.',
  [INDEX_STATUS.ready]: 'The index is ready.',
}

export const INDEX_STATUS_TEXT = {
  INDEXING_TITLE: 'Indexing this repository',
  POLL_NOTE: `This page checks the status every ${STATUS_POLL_MS / MILLISECONDS_PER_SECOND} seconds. You can leave and come back.`,
  FILES: 'Files',
  CHUNKS: 'Chunks',
  PENDING_COUNT: '—',
  FAILED_FALLBACK_TITLE: 'Indexing failed.',
  FAILED_REASON: 'Reason',
  RETRY: 'Retry',
  MISSING_TITLE: 'This index does not exist.',
  MISSING_DESCRIPTION: `The link is wrong, or the cleanup removed an index that nobody used for ${INDEX_RETENTION_DAYS} days.`,
  HOME_ACTION: 'Go to Home',
  REINDEX_TITLE: 'A newer commit is indexing.',
  REINDEX_TEXT: 'Answers use the earlier index until it is ready.',
  GITHUB: 'GitHub',
  HEADER_FILES: 'files',
  HEADER_CHUNKS: 'chunks',
  INDEXED: 'Indexed',
  INDEXING_PILL: 'Indexing',
  FAILED_PILL: 'Failed',
} as const

export function failedTitle(stage: IndexStage): string {
  return `Indexing failed at the ${STAGE_LABEL[stage].toLowerCase()} stage.`
}

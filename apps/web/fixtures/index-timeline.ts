import { INDEX_STATUS, type IndexStatus } from 'repotron-domain'

/** How long an index job stays in each stage. */
export type IndexTimeline = {
  queuedMs: number
  parsingMs: number
  embeddingMs: number
  failsAtParsing: boolean
}

export const INDEX_TIMELINE = {
  ready: { queuedMs: 0, parsingMs: 0, embeddingMs: 0, failsAtParsing: false },
  normal: { queuedMs: 2_500, parsingMs: 4_500, embeddingMs: 4_500, failsAtParsing: false },
  slow: { queuedMs: 10_000, parsingMs: 25_000, embeddingMs: 25_000, failsAtParsing: false },
  reindex: { queuedMs: 5_000, parsingMs: 15_000, embeddingMs: 15_000, failsAtParsing: false },
  failsAtParsing: { queuedMs: 2_500, parsingMs: 4_000, embeddingMs: 0, failsAtParsing: true },
} as const satisfies Record<string, IndexTimeline>

export function statusAt(timeline: IndexTimeline, elapsedMs: number): IndexStatus {
  if (elapsedMs < timeline.queuedMs) return INDEX_STATUS.queued
  const parsedAfterMs = timeline.queuedMs + timeline.parsingMs
  if (elapsedMs < parsedAfterMs) return INDEX_STATUS.parsing
  if (timeline.failsAtParsing) return INDEX_STATUS.failed
  if (elapsedMs < parsedAfterMs + timeline.embeddingMs) return INDEX_STATUS.embedding
  return INDEX_STATUS.ready
}

export function readyAfterMs(timeline: IndexTimeline): number {
  return timeline.queuedMs + timeline.parsingMs + timeline.embeddingMs
}

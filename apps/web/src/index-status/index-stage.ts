import { INDEX_STATUS, type IndexStatus } from 'repotron-domain'

/** The stages of an index job, in the order that the status card shows them. */
export const STAGE_ORDER = [
  INDEX_STATUS.queued,
  INDEX_STATUS.parsing,
  INDEX_STATUS.embedding,
  INDEX_STATUS.ready,
] as const

export type IndexStage = (typeof STAGE_ORDER)[number]

export const STAGE_STATE = {
  DONE: 'done',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
} as const

export type StageState = (typeof STAGE_STATE)[keyof typeof STAGE_STATE]

/** A terminal status does not change by itself, so the polling stops. */
export function isTerminalStatus(status: IndexStatus): boolean {
  return status === INDEX_STATUS.ready || status === INDEX_STATUS.failed || status === INDEX_STATUS.deleting
}

/** Places one stage before, at, or after the status of the index. */
export function stageStateOf(stage: IndexStage, status: IndexStatus): StageState {
  const stagePosition = STAGE_ORDER.indexOf(stage)
  const statusPosition = STAGE_ORDER.findIndex((entry) => entry === status)
  if (status === INDEX_STATUS.ready || stagePosition < statusPosition) return STAGE_STATE.DONE
  return stagePosition === statusPosition ? STAGE_STATE.CURRENT : STAGE_STATE.UPCOMING
}

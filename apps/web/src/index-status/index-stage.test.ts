import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDEX_STATUS } from 'repotron-domain'

import { isTerminalStatus, STAGE_STATE, stageStateOf } from './index-stage'

describe('index stage', () => {
  it('when the status is ready or failed, then isTerminalStatus returns true', () => {
    const results = [isTerminalStatus(INDEX_STATUS.ready), isTerminalStatus(INDEX_STATUS.failed)]

    assert.deepEqual(results, [true, true])
  })

  it('when the index job still runs, then isTerminalStatus returns false', () => {
    const results = [
      isTerminalStatus(INDEX_STATUS.queued),
      isTerminalStatus(INDEX_STATUS.parsing),
      isTerminalStatus(INDEX_STATUS.embedding),
    ]

    assert.deepEqual(results, [false, false, false])
  })

  it('when the status is parsing, then the queued stage is done and the embedding stage is upcoming', () => {
    const states = [
      stageStateOf(INDEX_STATUS.queued, INDEX_STATUS.parsing),
      stageStateOf(INDEX_STATUS.parsing, INDEX_STATUS.parsing),
      stageStateOf(INDEX_STATUS.embedding, INDEX_STATUS.parsing),
    ]

    assert.deepEqual(states, [STAGE_STATE.DONE, STAGE_STATE.CURRENT, STAGE_STATE.UPCOMING])
  })

  it('when the status is ready, then the ready stage is done', () => {
    const state = stageStateOf(INDEX_STATUS.ready, INDEX_STATUS.ready)

    assert.equal(state, STAGE_STATE.DONE)
  })
})

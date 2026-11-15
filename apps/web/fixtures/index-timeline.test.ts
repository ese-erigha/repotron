import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDEX_STATUS } from 'repotron-domain'

import { INDEX_TIMELINE, readyAfterMs, statusAt } from './index-timeline.ts'

describe('index timeline', () => {
  it('when the job just started, then the status is queued', () => {
    assert.equal(statusAt(INDEX_TIMELINE.normal, 0), INDEX_STATUS.queued)
  })

  it('when the elapsed time passes the queued stage, then the status is parsing', () => {
    assert.equal(statusAt(INDEX_TIMELINE.normal, INDEX_TIMELINE.normal.queuedMs), INDEX_STATUS.parsing)
  })

  it('when the elapsed time passes the parsing stage, then the status is embedding', () => {
    const elapsedMs = INDEX_TIMELINE.normal.queuedMs + INDEX_TIMELINE.normal.parsingMs

    assert.equal(statusAt(INDEX_TIMELINE.normal, elapsedMs), INDEX_STATUS.embedding)
  })

  it('when the elapsed time passes every stage, then the status is ready', () => {
    assert.equal(statusAt(INDEX_TIMELINE.normal, readyAfterMs(INDEX_TIMELINE.normal)), INDEX_STATUS.ready)
  })

  it('when the timeline fails at parsing, then the status is failed after the parsing stage', () => {
    const timeline = INDEX_TIMELINE.failsAtParsing

    assert.equal(statusAt(timeline, timeline.queuedMs + timeline.parsingMs), INDEX_STATUS.failed)
  })

  it('when the timeline has no wait, then the status is ready at once', () => {
    assert.equal(statusAt(INDEX_TIMELINE.ready, 0), INDEX_STATUS.ready)
  })
})

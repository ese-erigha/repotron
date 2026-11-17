import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDEX_STATUS, indexViewSchema, questionViewSchema } from 'repotron-domain'

import { SEED_QUESTIONS } from './data/seed-repositories.ts'
import { FixtureRequestError, FixtureStore } from './fixture-store.ts'
import { INDEX_TIMELINE, readyAfterMs } from './index-timeline.ts'
import { LINK_SCENARIO } from './scenarios.ts'

const NOW = 1_794_700_000_000

const NEW_LINK = { owner: 'vercel', name: 'next.js' }

function linkOf(scenario: string): { owner: string; name: string } {
  const [owner = '', name = ''] = scenario.split('/')
  return { owner, name }
}

describe('fixture store', () => {
  it('when the store starts, then each recent index matches the schema of the gateway', () => {
    const store = new FixtureStore(NOW)

    const indexes = store.listRecentIndexes(NOW)

    assert.deepEqual(indexViewSchema.array().parse(indexes), indexes)
  })

  it('when the store starts, then a seed answer matches the schema of the gateway', () => {
    const store = new FixtureStore(NOW)

    const question = store.getQuestion(SEED_QUESTIONS[0]?.id ?? '')

    assert.deepEqual(questionViewSchema.parse(question), question)
  })

  it('when a new link is requested, then the store creates a queued index', () => {
    const store = new FixtureStore(NOW)

    const result = store.requestIndex(NEW_LINK, NOW)

    assert.deepEqual(
      { status: result.status, indexStatus: result.index.status, fileCount: result.index.fileCount },
      { status: 201, indexStatus: INDEX_STATUS.queued, fileCount: null },
    )
  })

  it('when the same link is requested again, then the store returns the existing index', () => {
    const store = new FixtureStore(NOW)
    const first = store.requestIndex(NEW_LINK, NOW)

    const second = store.requestIndex(NEW_LINK, NOW + 1_000)

    assert.deepEqual({ status: second.status, id: second.index.id }, { status: 200, id: first.index.id })
  })

  it('when the job is embedding, then the chunk count grows before the index is ready', () => {
    const store = new FixtureStore(NOW)
    const embeddingStart = INDEX_TIMELINE.normal.queuedMs + INDEX_TIMELINE.normal.parsingMs
    const span = INDEX_TIMELINE.normal.embeddingMs
    store.requestIndex(NEW_LINK, NOW)

    const early = store.requestIndex(NEW_LINK, NOW + embeddingStart + Math.floor(span * 0.2))
    const later = store.requestIndex(NEW_LINK, NOW + embeddingStart + Math.floor(span * 0.6))
    const ready = store.requestIndex(NEW_LINK, NOW + readyAfterMs(INDEX_TIMELINE.normal))

    assert.equal(early.index.status, INDEX_STATUS.embedding)
    assert.equal(early.index.chunkTotal, ready.index.chunkCount)
    assert.ok(early.index.chunkCount !== null && early.index.chunkCount > 0)
    assert.ok(later.index.chunkCount !== null && early.index.chunkCount < later.index.chunkCount)
    assert.ok(later.index.chunkCount < (ready.index.chunkCount ?? 0))
  })

  it('when every stage of the job passed, then the index is ready with its counts', () => {
    const store = new FixtureStore(NOW)
    const created = store.requestIndex(NEW_LINK, NOW)

    const later = store.requestIndex(NEW_LINK, NOW + readyAfterMs(INDEX_TIMELINE.normal))

    assert.deepEqual(
      { status: later.index.status, hasCounts: later.index.chunkCount !== null, id: later.index.id },
      { status: INDEX_STATUS.ready, hasCounts: true, id: created.index.id },
    )
  })

  it('when a link names a private repository, then the store refuses it with the gateway message', () => {
    const store = new FixtureStore(NOW)

    assert.throws(
      () => store.requestIndex(linkOf(LINK_SCENARIO.private), NOW),
      (error: FixtureRequestError) => error.detail.status === 404 && error.detail.code === 'repository_not_found',
    )
  })

  it('when a failed index is requested again, then the job restarts with the same id', () => {
    const store = new FixtureStore(NOW)
    const link = linkOf(LINK_SCENARIO.failsParsing)
    const created = store.requestIndex(link, NOW)
    const failedAt = NOW + readyAfterMs(INDEX_TIMELINE.failsAtParsing)

    const retried = store.requestIndex(link, failedAt)

    assert.deepEqual(
      { status: retried.index.status, id: retried.index.id },
      { status: INDEX_STATUS.queued, id: created.index.id },
    )
  })

  it('when a newer commit indexes, then the index names the earlier ready index', () => {
    const store = new FixtureStore(NOW)

    const result = store.requestIndex(linkOf(LINK_SCENARIO.newCommit), NOW)

    assert.equal(typeof result.index.fallbackIndexId, 'string')
  })
})

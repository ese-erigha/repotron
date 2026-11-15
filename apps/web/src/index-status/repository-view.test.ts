import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDEX_STATUS, type IndexView } from 'repotron-domain'

import { activeIndexIdOf, REPOSITORY_VIEW, selectRepositoryView } from './repository-view'

const READY_INDEX: IndexView = {
  id: 'index-new',
  repository: { owner: 'honojs', name: 'hono' },
  commitSha: 'f6fbaf0299c48eea9e656e03e2ffe7ac755e8823',
  status: INDEX_STATUS.ready,
  failedStage: null,
  failureReason: null,
  fileCount: 742,
  chunkCount: 6183,
  fallbackIndexId: null,
  createdAt: 1_794_700_000_000,
  readyAt: 1_794_700_300_000,
}

const PARSING_INDEX: IndexView = { ...READY_INDEX, status: INDEX_STATUS.parsing, readyAt: null }

describe('selectRepositoryView', () => {
  it('when the URL holds no index id, then the view is the start card', () => {
    const view = selectRepositoryView({ indexId: null, index: null, isMissing: false, hasError: false })

    assert.equal(view, REPOSITORY_VIEW.START)
  })

  it('when the gateway states that the index does not exist, then the view is missing', () => {
    const view = selectRepositoryView({ indexId: 'index-new', index: null, isMissing: true, hasError: true })

    assert.equal(view, REPOSITORY_VIEW.MISSING)
  })

  it('when the index is ready, then the view is the ask panel', () => {
    const view = selectRepositoryView({ indexId: 'index-new', index: READY_INDEX, isMissing: false, hasError: false })

    assert.equal(view, REPOSITORY_VIEW.ASK)
  })

  it('when the index job runs and no earlier index is ready, then the view is the status card', () => {
    const view = selectRepositoryView({ indexId: 'index-new', index: PARSING_INDEX, isMissing: false, hasError: false })

    assert.equal(view, REPOSITORY_VIEW.INDEXING)
  })

  it('when the index job runs and an earlier index is ready, then the view keeps the ask panel', () => {
    const index: IndexView = { ...PARSING_INDEX, fallbackIndexId: 'index-old' }

    const view = selectRepositoryView({ indexId: 'index-new', index, isMissing: false, hasError: false })

    assert.equal(view, REPOSITORY_VIEW.REINDEXING)
  })

  it('when the first status read fails for another reason, then the view is unavailable', () => {
    const view = selectRepositoryView({ indexId: 'index-new', index: null, isMissing: false, hasError: true })

    assert.equal(view, REPOSITORY_VIEW.UNAVAILABLE)
  })
})

describe('activeIndexIdOf', () => {
  it('when a newer commit indexes, then the earlier index answers the questions', () => {
    const index: IndexView = { ...PARSING_INDEX, fallbackIndexId: 'index-old' }

    assert.equal(activeIndexIdOf(index), 'index-old')
  })

  it('when the index is ready, then that index answers the questions', () => {
    assert.equal(activeIndexIdOf(READY_INDEX), 'index-new')
  })
})

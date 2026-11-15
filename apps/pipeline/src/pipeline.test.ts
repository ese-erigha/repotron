import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { PipelineContext } from './context.ts'
import { pipelineStorage } from './context.ts'
import { startDeletions } from './delete-stale-indexes/delete-stale-indexes.ts'
import { deleteNextPage } from './index-deletion/delete-page.ts'
import { readParseResult } from './indexer-container/parse-result.ts'
import { assertVectorsReady } from './repository-indexing/wait-for-vectors.ts'

describe('assertVectorsReady', () => {
  it('when the vectors were processed before the last upsert, then the wait throws', async () => {
    const context = vectorsContext('2026-01-01T00:00:00.000Z')
    await assert.rejects(
      () => pipelineStorage.run(context, () => assertVectorsReady('2026-01-01T00:00:05.000Z')),
      /not ready/,
    )
  })

  it('when the vectors were processed after the last upsert, then the wait finishes', async () => {
    const context = vectorsContext('2026-01-01T00:00:10.000Z')
    await pipelineStorage.run(context, () => assertVectorsReady('2026-01-01T00:00:05.000Z'))
  })
})

describe('deleteNextPage', () => {
  it('when a page of chunks is deleted, then the vectors are deleted before the rows', async () => {
    const order: string[] = []
    const context = {
      repositories: {
        sourceChunks: {
          listIdPage: async () => ['9-abc:0'],
          deleteThrough: async () => {
            order.push('rows')
          },
        },
      },
      vectors: {
        deleteByIds: async () => {
          order.push('vectors')
        },
      },
    } as unknown as PipelineContext
    const deleted = await pipelineStorage.run(context, () => deleteNextPage('9-abc'))
    assert.equal(deleted, true)
    assert.deepEqual(order, ['vectors', 'rows'])
  })
})

describe('startDeletions', () => {
  it('when a deletion instance already exists, then the other indexes are still started', async () => {
    const started: string[] = []
    const context = {
      indexDeletion: {
        createBatch: async () => {
          throw new Error('instance already exists')
        },
        create: async (instance: { id: string }) => {
          started.push(instance.id)
        },
        get: () => ({ restart: async () => undefined }),
      },
    } as unknown as PipelineContext
    await pipelineStorage.run(context, () => startDeletions(['9-old', '9-older']))
    assert.deepEqual(started, ['delete-9-old', 'delete-9-older'])
  })
})

describe('readParseResult', () => {
  it('when the container returns a reason, then the error uses that reason', async () => {
    const response = Response.json({ reason: 'The repository download was not found.' }, { status: 400 })
    await assert.rejects(() => readParseResult(response), /not found/)
  })
})

function vectorsContext(processedUpToDatetime: string): PipelineContext {
  return {
    vectors: { describe: async () => ({ processedUpToDatetime }) },
  } as unknown as PipelineContext
}

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setTimeout } from 'node:timers/promises'

import type { PipelineContext } from './context.ts'
import { pipelineStorage } from './context.ts'
import { startDeletions } from './delete-stale-indexes/delete-stale-indexes.ts'
import { deleteNextPage } from './index-deletion/delete-page.ts'
import { embedTexts } from './embeddings.ts'
import { readParseResult } from './indexer-container/parse-result.ts'
import { storeBatch } from './repository-indexing/store-batch.ts'
import { assertVectorsReady } from './repository-indexing/wait-for-vectors.ts'

let embedTrack: { active: number; max: number } | null = null

globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
  const payload = JSON.parse(String(init?.body)) as { input: string[] }
  const watch = embedTrack
  const numbered = payload.input.every((text) => text.startsWith('text-'))
  if (watch && numbered) {
    watch.active += 1
    watch.max = Math.max(watch.max, watch.active)
    await setTimeout(20)
    watch.active -= 1
  }
  const data = payload.input.map((text, index) => ({
    index,
    embedding: [text.startsWith('text-') ? Number(text.slice('text-'.length)) : 0.1],
  }))
  return Response.json({ data })
}) as typeof fetch

describe('assertVectorsReady', () => {
  it('when the vectors were processed before the last upsert, then the error names both times', async () => {
    const context = vectorsContext('2026-01-01T00:00:00.000Z')
    await assert.rejects(
      () => pipelineStorage.run(context, () => assertVectorsReady('2026-01-01T00:00:05.000Z')),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /2026-01-01T00:00:00.000Z/)
        assert.match(error.message, /2026-01-01T00:00:05.000Z/)
        return true
      },
    )
  })

  it('when Vectorize returns no processed time, then the error says the time is missing', async () => {
    const context = { vectors: { describe: async () => ({}) } } as unknown as PipelineContext
    await assert.rejects(
      () => pipelineStorage.run(context, () => assertVectorsReady('2026-01-01T00:00:05.000Z')),
      /missing/,
    )
  })

  it('when the vectors were processed after the last upsert, then the wait finishes', async () => {
    const context = vectorsContext('2026-01-01T00:00:10.000Z')
    await pipelineStorage.run(context, () => assertVectorsReady('2026-01-01T00:00:05.000Z'))
  })
})

describe('embedTexts', { concurrency: false }, () => {
  it('when 12 texts are embedded, then 10 calls run together', async () => {
    embedTrack = { active: 0, max: 0 }
    const run = await embedNumberedTexts(12)
    embedTrack = null

    assert.equal(run.maxActive, 10)
  })

  it('when 12 texts are embedded, then each vector keeps its text position', async () => {
    const run = await embedNumberedTexts(12)

    assert.deepEqual(
      run.vectors,
      [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11]],
    )
  })
})

describe('storeBatch', () => {
  it('when a batch is stored, then the recorded time is from before the upsert', async () => {
    let upsertStartedAt = 0
    const context = batchContext({
      text: chunkLine(0),
      onUpsert: async () => {
        upsertStartedAt = Date.now()
        await setTimeout(30)
      },
    })
    const recorded = await pipelineStorage.run(context, () => storeBatch('9-abc', 'batch-0.jsonl', 1))
    assert.ok(Date.parse(recorded) <= upsertStartedAt)
  })

  it('when 12 chunks are stored, then the count is saved after each wave of 10', async () => {
    const saved: number[] = []
    const context = batchContext({
      text: Array.from({ length: 12 }, (_, seq) => chunkLine(seq)).join('\n'),
      onProgress: (chunkCount) => {
        saved.push(chunkCount)
      },
    })
    await pipelineStorage.run(context, () => storeBatch('9-abc', 'batch-0.jsonl', 12))
    assert.deepEqual(saved, [10, 12])
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

async function embedNumberedTexts(count: number): Promise<{ maxActive: number; vectors: number[][] }> {
  const texts = Array.from({ length: count }, (_, index) => `text-${index}`)
  const context = {
    config: {
      AI_GATEWAY_ID: 'gateway',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      OPENROUTER_API_KEY: 'openrouter',
      CF_AIG_TOKEN: 'gateway-token',
    },
  } as unknown as PipelineContext
  const vectors = await pipelineStorage.run(context, () => embedTexts(texts))
  return { maxActive: embedTrack?.max ?? 0, vectors }
}

function chunkLine(seq: number): string {
  return JSON.stringify({
    id: `9-abc:${seq}`,
    seq,
    path: 'src/a.ts',
    language: 'typescript',
    symbol: null,
    kind: 'function',
    startLine: 1,
    endLine: 2,
    content: `const a = ${seq}`,
    header: 'a',
    identifiers: 'a',
  })
}

function batchContext(input: {
  text: string
  onUpsert?: () => Promise<void>
  onProgress?: (chunkCount: number) => void
}): PipelineContext {
  let stored = 0
  return {
    config: {
      AI_GATEWAY_ID: 'gateway',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      OPENROUTER_API_KEY: 'openrouter',
      CF_AIG_TOKEN: 'gateway-token',
    },
    batches: { get: async () => ({ text: async () => input.text }) },
    repositories: {
      sourceChunks: {
        insertBatch: async (rows: unknown[]) => {
          stored += rows.length
        },
        countByIndex: async () => stored,
      },
      repositoryIndexes: {
        recordChunkProgress: async (progress: { chunkCount: number }) => {
          input.onProgress?.(progress.chunkCount)
        },
      },
    },
    ai: {
      run: async (_model: string, body: { input: string[] }) => ({
        data: body.input.map(() => ({ embedding: [0.1] })),
      }),
    },
    vectors: { upsert: async () => input.onUpsert?.() },
  } as unknown as PipelineContext
}

function vectorsContext(processedUpToDatetime: string): PipelineContext {
  return {
    vectors: { describe: async () => ({ processedUpToDatetime }) },
  } as unknown as PipelineContext
}

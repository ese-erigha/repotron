import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SourceChunkRecord } from 'db'

import { gatewayStorage, type GatewayContext } from '../../context.ts'
import type { GatewayEnv } from '../../env.ts'
import { retrieveAnswerChunks, retrieveHybridChunks } from './retrieve-chunks.ts'

const config = {
  APP_ORIGIN: 'https://repotron.example',
  CLOUDFLARE_ACCOUNT_ID: 'account',
  AI_GATEWAY_ID: 'gateway',
  ANSWER_MODEL_ID: 'model',
  TURNSTILE_SECRET: 'turnstile',
  GITHUB_TOKEN: 'github',
  OPENROUTER_API_KEY: 'openrouter',
  CF_AIG_TOKEN: 'gateway-token',
  EVAL_TOKEN: 'eval-token',
} satisfies GatewayEnv

describe('retrieveAnswerChunks', () => {
  it('when the keyword chunk is outside the semantic list, then the answer list ends with that chunk', async () => {
    const chunks = await gatewayStorage.run(context(['semantic'], ['keyword']), () =>
      retrieveAnswerChunks('9-abc', 'How does routing work?'),
    )

    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ['semantic', 'keyword'],
    )
  })

  it('when the keyword chunk is already in the semantic list, then the answer list does not grow', async () => {
    const chunks = await gatewayStorage.run(context(['semantic'], ['semantic']), () =>
      retrieveAnswerChunks('9-abc', 'How does routing work?'),
    )

    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ['semantic'],
    )
  })

  it('when the keyword chunk scores higher, then it moves ahead of the semantic chunk', async () => {
    const chunks = await gatewayStorage.run(context(['semantic'], ['keyword'], { keyword: 0.9, semantic: 0.2 }), () =>
      retrieveAnswerChunks('9-abc', 'How does routing work?'),
    )

    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ['keyword', 'semantic'],
    )
  })

  it('when the hybrid list is built, then the rerank call is skipped', async () => {
    let rerankCalls = 0
    const chunks = await gatewayStorage.run(
      context(['semantic'], ['keyword'], undefined, () => {
        rerankCalls += 1
      }),
      () => retrieveHybridChunks('9-abc', 'How does routing work?'),
    )

    assert.equal(rerankCalls, 0)
    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ['semantic', 'keyword'],
    )
  })

  it('when the question asks where a symbol is, then that chunk stays first even if another chunk scores higher', async () => {
    const chunks = await gatewayStorage.run(context(['other', 'named'], ['other'], { other: 0.9, named: 0.1 }), () =>
      retrieveAnswerChunks('9-abc', 'Where is named defined?'),
    )

    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ['named', 'other'],
    )
  })
})

function context(
  vectorIds: string[],
  keywordIds: string[],
  scores?: Record<string, number>,
  onRerank?: () => void,
): GatewayContext {
  globalThis.fetch = (async (url: string, init?: { body?: unknown }) => {
    if (url.endsWith('/rerank')) {
      onRerank?.()
      return Response.json({ results: rerankResults(init?.body, scores) })
    }
    return Response.json({ data: [{ embedding: [0.1], index: 0 }] })
  }) as typeof fetch
  const rows = new Map([...vectorIds, ...keywordIds].map((id) => [id, chunk(id)]))
  return {
    config,
    repositories: {
      sourceChunks: {
        listByIds: async (query: { ids: string[] }) =>
          query.ids.flatMap((id) => {
            const row = rows.get(id)
            return row ? [row] : []
          }),
        listIdsByKeyword: async () => keywordIds,
      },
    },
    vectors: {
      query: async () => ({ matches: vectorIds.map((id) => ({ id })) }),
    },
  } as unknown as GatewayContext
}

function rerankResults(
  body: unknown,
  scores?: Record<string, number>,
): { index: number; relevance_score: number }[] {
  const documents = documentsFrom(body)
  return documents.map((document, index) => ({
    index,
    relevance_score: scoreFor(document, index, documents.length, scores),
  }))
}

function documentsFrom(body: unknown): string[] {
  if (typeof body !== 'string') return []
  const parsed: unknown = JSON.parse(body)
  if (typeof parsed !== 'object' || parsed === null || !('documents' in parsed)) return []
  const documents = parsed.documents
  return Array.isArray(documents) ? documents.filter((item): item is string => typeof item === 'string') : []
}

function scoreFor(document: string, index: number, count: number, scores?: Record<string, number>): number {
  if (!scores) return count - index
  const match = Object.keys(scores).find((id) => document.includes(id))
  return match ? (scores[match] ?? 0) : 0
}

function chunk(id: string): SourceChunkRecord {
  return {
    id,
    indexId: '9-abc',
    seq: 1,
    path: 'src/a.ts',
    language: 'typescript',
    symbol: id,
    kind: 'function',
    startLine: 1,
    endLine: 2,
    content: id,
    identifiers: id,
  }
}

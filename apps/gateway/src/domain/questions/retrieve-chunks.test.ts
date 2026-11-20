import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SourceChunkRecord } from 'db'

import { gatewayStorage, type GatewayContext } from '../../context.ts'
import type { GatewayEnv } from '../../env.ts'
import { retrieveAnswerChunks } from './retrieve-chunks.ts'

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

  it('when the question asks where a symbol is, then that chunk stays first', async () => {
    const chunks = await gatewayStorage.run(context(['other', 'named'], ['other']), () =>
      retrieveAnswerChunks('9-abc', 'Where is named defined?'),
    )

    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ['named', 'other'],
    )
  })
})

function context(vectorIds: string[], keywordIds: string[]): GatewayContext {
  globalThis.fetch = (async () => Response.json({ data: [{ embedding: [0.1], index: 0 }] })) as typeof fetch
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

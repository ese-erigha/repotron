import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { INDEX_STATUS } from 'repotron-domain'

import { gatewayStorage, type GatewayContext } from '../../../context.ts'
import type { GatewayEnv } from '../../../env.ts'
import { RequestError } from '../../../http-error.ts'
import { askQuestion } from './ask-question.usecase.ts'

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

const indexRow = {
  id: '9-abc',
  repositoryId: '9',
  commitSha: 'abc',
  status: INDEX_STATUS.ready,
}

describe('askQuestion', () => {
  it('when the eval token matches, then the question does not call the rate limit', async () => {
    const calls = { n: 0 }
    const stream = await gatewayStorage.run(context({ calls, allowed: true }), () =>
      askQuestion({
        indexId: '9-abc',
        body: { question: 'Where?' },
        remoteIp: '203.0.113.5',
        evalToken: 'eval-token',
        retrieval: '',
      }),
    )
    await new Response(stream).text()
    assert.equal(calls.n, 0)
  })

  it('when the eval token is absent and the question limit is full, then the question is refused', async () => {
    const calls = { n: 0 }
    await assert.rejects(
      () =>
        gatewayStorage.run(context({ calls, allowed: false }), () =>
          askQuestion({
            indexId: '9-abc',
            body: { question: 'Where?' },
            remoteIp: '203.0.113.5',
            evalToken: '',
            retrieval: 'bm25',
          }),
        ),
      (error: unknown) => error instanceof RequestError && error.status === 429,
    )
    assert.equal(calls.n, 1)
  })

  it('when retrieval is omitted, then the question searches vectors and skips the keyword query', async () => {
    const keyword = { indexId: '', match: '' }
    let vectorQueries = 0
    const stream = await gatewayStorage.run(
      context({
        calls: { n: 0 },
        allowed: true,
        keyword,
        onVectorQuery: () => {
          vectorQueries += 1
        },
      }),
      () =>
        askQuestion({
          indexId: '9-abc',
          body: { question: 'Where is getUserById?' },
          remoteIp: '203.0.113.5',
          evalToken: '',
          retrieval: '',
        }),
    )
    await new Response(stream).text()

    assert.equal(keyword.indexId, '')
    assert.equal(vectorQueries, 1)
  })

  it('when the question names a path prefix, then the vector query filters that prefix', async () => {
    let filter: { path?: { $gte: string; $lt: string } } | undefined
    const stream = await gatewayStorage.run(
      context({
        calls: { n: 0 },
        allowed: true,
        onVectorQuery: (options) => {
          filter = options.filter
        },
      }),
      () =>
        askQuestion({
          indexId: '9-abc',
          body: { question: 'Where is the route defined?', pathPrefix: 'src/flask/' },
          remoteIp: '203.0.113.5',
          evalToken: '',
          retrieval: '',
        }),
    )
    await new Response(stream).text()

    assert.deepEqual(filter, { path: { $gte: 'src/flask/', $lt: 'src/flask0' } })
  })

  it('when the eval token matches and retrieval is bm25, then the keyword query binds the index id', async () => {
    const keyword = { indexId: '', match: '' }
    let vectorQueries = 0
    const stream = await gatewayStorage.run(
      context({
        calls: { n: 0 },
        allowed: true,
        keyword,
        onVectorQuery: () => {
          vectorQueries += 1
        },
      }),
      () =>
        askQuestion({
          indexId: '9-abc',
          body: { question: 'Where is getUserById?' },
          remoteIp: '203.0.113.5',
          evalToken: 'eval-token',
          retrieval: 'bm25',
        }),
    )
    await new Response(stream).text()

    assert.equal(keyword.indexId, '9-abc')
    assert.equal(keyword.match.includes('9-abc'), false)
    assert.equal(keyword.match.includes('"getUserById"'), true)
    assert.equal(vectorQueries, 0)
  })
})

function context(input: {
  calls: { n: number }
  allowed: boolean
  keyword?: { indexId: string; match: string }
  onVectorQuery?: (options: { filter?: { path?: { $gte: string; $lt: string } } }) => void
}): GatewayContext {
  globalThis.fetch = (async () => Response.json({ data: [{ embedding: [0.1], index: 0 }] })) as typeof fetch
  return {
    config,
    repositories: {
      repositoryIndexes: {
        get: async () => indexRow,
        recordQuestion: async () => undefined,
      },
      githubRepositories: { get: async () => ({ id: '9', owner: 'owner', name: 'repo' }) },
      sourceChunks: {
        listByIds: async () => [],
        listIdsByKeyword: async (query: { indexId: string; match: string }) => {
          if (input.keyword) {
            input.keyword.indexId = query.indexId
            input.keyword.match = query.match
          }
          return []
        },
      },
      answeredQuestions: { insert: async () => undefined },
    },
    vectors: {
      query: async (_vector: number[], options: { filter?: { path?: { $gte: string; $lt: string } } }) => {
        input.onVectorQuery?.(options)
        return { matches: [] }
      },
    },
    ai: { run: async () => ({ data: [{ embedding: [0.1] }] }) },
    rateLimiter: {
      getByName: () => ({
        consume: async () => {
          input.calls.n += 1
          return input.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 }
        },
      }),
    },
    execution: { waitUntil() {} },
  } as unknown as GatewayContext
}

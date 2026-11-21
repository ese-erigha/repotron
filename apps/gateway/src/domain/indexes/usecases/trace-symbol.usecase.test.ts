import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { INDEX_STATUS, SYMBOL_HIT_ROLE } from 'repotron-domain'

import { gatewayStorage, type GatewayContext } from '../../../context.ts'
import type { GatewayEnv } from '../../../env.ts'
import { RequestError } from '../../../http-error.ts'
import { traceSymbol } from './trace-symbol.usecase.ts'

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

describe('traceSymbol', () => {
  it('when a usage is stored ahead of the definition, then the definition comes first', async () => {
    const trace = await gatewayStorage.run(context(true), () =>
      traceSymbol({ indexId: '9-abc', name: 'jsonify', remoteIp: '203.0.113.5' }),
    )

    assert.deepEqual(
      trace.hits.map((hit) => hit.role),
      [SYMBOL_HIT_ROLE.definition, SYMBOL_HIT_ROLE.usage],
    )
    assert.equal(trace.hits[0]?.path, 'src/flask/json/__init__.py')
  })

  it('when the trace runs, then it does not call a model', async () => {
    let modelCalls = 0
    globalThis.fetch = (() => {
      modelCalls += 1
      return Promise.reject(new Error('The trace called a model.'))
    }) as typeof fetch
    await gatewayStorage.run(context(true), () =>
      traceSymbol({ indexId: '9-abc', name: 'jsonify', remoteIp: '203.0.113.5' }),
    )

    assert.equal(modelCalls, 0)
  })

  it('when the hourly question limit is already reached, then the trace is refused', async () => {
    await assert.rejects(
      () => gatewayStorage.run(context(false), () => traceSymbol({ indexId: '9-abc', name: 'jsonify', remoteIp: '203.0.113.5' })),
      (error: unknown) => error instanceof RequestError && error.status === 429,
    )
  })
})

function context(allowed: boolean): GatewayContext {
  return {
    config,
    repositories: {
      repositoryIndexes: {
        get: async () => ({
          id: '9-abc',
          repositoryId: '9',
          commitSha: 'abc',
          status: INDEX_STATUS.ready,
        }),
      },
      githubRepositories: { get: async () => ({ id: '9', owner: 'pallets', name: 'flask' }) },
      sourceChunks: {
        listBySymbol: async () => [
          { path: 'src/flask/app.py', symbol: 'dispatch', startLine: 10, endLine: 20 },
          { path: 'src/flask/json/__init__.py', symbol: 'jsonify', startLine: 138, endLine: 170 },
        ],
      },
    },
    rateLimiter: {
      getByName: () => ({
        consume: async () => (allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 }),
      }),
    },
  } as unknown as GatewayContext
}

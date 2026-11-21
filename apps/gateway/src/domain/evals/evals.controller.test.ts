import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EvalSummary } from 'repotron-domain'

import app from '../../app.ts'
import type { EvalReportBucket } from '../../context.ts'

const env = {
  APP_ORIGIN: 'https://repotron.example',
  CLOUDFLARE_ACCOUNT_ID: 'account',
  AI_GATEWAY_ID: 'gateway',
  ANSWER_MODEL_ID: 'model',
  TURNSTILE_SECRET: 'turnstile',
  GITHUB_TOKEN: 'github',
  OPENROUTER_API_KEY: 'openrouter',
  CF_AIG_TOKEN: 'gateway-token',
  EVAL_TOKEN: 'eval-token',
  DB: {},
}

describe('listEvalSummaries', () => {
  it('when the bucket lists the older summary first, then the route returns the newer summary first', async () => {
    const older = summary('aaa', 1)
    const newer = summary('bbb', 2)

    const response = await app.request('/api/v1/evals', {}, requestEnv(bucketOf([[older, newer]])))

    assert.equal(response.status, 200)
    const body = (await response.json()) as { evals: EvalSummary[] }
    assert.deepEqual(
      body.evals.map((item) => item.commitSha),
      ['bbb', 'aaa'],
    )
  })

  it('when the route lists the summaries, then it calls no model', async () => {
    const calls: string[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async () => {
      calls.push('fetch')
      throw new Error('The eval route called fetch.')
    }) as typeof fetch
    try {
      const response = await app.request('/api/v1/evals', {}, requestEnv(bucketOf([[summary('aaa', 1)]])))
      assert.equal(response.status, 200)
      assert.deepEqual(calls, [])
    } finally {
      globalThis.fetch = original
    }
  })

  it('when the bucket splits the summaries across pages, then the route returns both', async () => {
    const response = await app.request(
      '/api/v1/evals',
      {},
      requestEnv(bucketOf([[summary('aaa', 1)], [summary('bbb', 2)]])),
    )

    assert.equal(response.status, 200)
    const body = (await response.json()) as { evals: EvalSummary[] }
    assert.deepEqual(
      body.evals.map((item) => item.commitSha),
      ['bbb', 'aaa'],
    )
  })
})

function requestEnv(bucket: EvalReportBucket): Record<string, unknown> {
  return { ...env, CHUNK_BATCHES: bucket }
}

function bucketOf(pages: EvalSummary[][]): EvalReportBucket {
  let pageIndex = 0
  const summaries = pages.flat()
  return {
    async list() {
      const page = pages[pageIndex] ?? []
      const truncated = pageIndex < pages.length - 1
      pageIndex += 1
      return {
        objects: page.map((item) => ({ key: `evals/${item.commitSha}.json` })),
        truncated,
        cursor: truncated ? `page-${pageIndex}` : undefined,
      }
    },
    async get(key) {
      const found = summaries.find((item) => key === `evals/${item.commitSha}.json`)
      if (!found) return null
      return { json: async () => found }
    },
  }
}

function summary(commitSha: string, createdAt: number): EvalSummary {
  return {
    commitSha,
    createdAt,
    scores: {
      recall: 0.66,
      precision: 0.09,
      faithfulness: 0.99,
      answerRelevance: 0.88,
      citationAccuracy: 0.15,
      refusalAccuracy: 1,
      identifierHitAt1: 1,
    },
    latency: { retrievalP95Ms: 400, firstTokenP95Ms: 900 },
    cost: { dollars: 0.01 },
  }
}

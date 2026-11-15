import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ERROR_CODE, STREAM_EVENT } from 'repotron-domain'

import { gatewayStorage, type GatewayContext } from '../../context.ts'
import type { GatewayEnv } from '../../env.ts'
import { RequestError } from '../../http-error.ts'
import { openAnswerStream } from './stream-answer.ts'
import { readQuestion } from './usecases/read-question.usecase.ts'

const config = {
  APP_ORIGIN: 'https://repotron.example',
  CLOUDFLARE_ACCOUNT_ID: 'account',
  AI_GATEWAY_ID: 'gateway',
  ANSWER_MODEL_ID: 'model',
  TURNSTILE_SECRET: 'turnstile',
  GITHUB_TOKEN: 'github',
  OPENROUTER_API_KEY: 'openrouter',
} satisfies GatewayEnv

const index = {
  id: '9-abc',
  repositoryFullName: 'owner/repo',
  commitSha: 'abc',
  owner: 'owner',
  name: 'repo',
}

describe('openAnswerStream', () => {
  it('when the model fails, then the stream sends error and writes no question', async () => {
    const saved: string[] = []
    const pending: Promise<unknown>[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response('no', { status: 500 })) as typeof fetch
    try {
      const events = await gatewayStorage.run(context(saved, pending), async () =>
        readEvents(openAnswerStream({ index, question: 'Where?', preset: null, chunks: [chunk()], paths: [], startedAt: 1 })),
      )
      await Promise.all(pending)
      assert.deepEqual(events.map((event) => event.name), [STREAM_EVENT.retrieval, STREAM_EVENT.error])
      assert.equal(events[1]?.data.code, ERROR_CODE.internal)
      assert.deepEqual(saved, [])
    } finally {
      globalThis.fetch = original
    }
  })

  it('when the model returns tokens, then the stream sends retrieval, token, and done', async () => {
    const saved: string[] = []
    const pending: Promise<unknown>[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response('data: {"choices":[{"delta":{"content":"See [1]."}}]}\n\ndata: [DONE]\n\n')) as typeof fetch
    try {
      const events = await gatewayStorage.run(context(saved, pending), async () =>
        readEvents(openAnswerStream({ index, question: 'Where?', preset: null, chunks: [chunk()], paths: [], startedAt: 1 })),
      )
      await Promise.all(pending)
      assert.deepEqual(events.map((event) => event.name), [STREAM_EVENT.retrieval, STREAM_EVENT.token, STREAM_EVENT.done])
      assert.deepEqual(saved, ['9-abc'])
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('readQuestion', () => {
  it('when the question id is unknown, then the read returns not found', async () => {
    await assert.rejects(
      () => gatewayStorage.run(context([], []), () => readQuestion('missing')),
      (error: unknown) => error instanceof RequestError && error.status === 404,
    )
  })
})

function context(saved: string[], pending: Promise<unknown>[]): GatewayContext {
  return {
    config,
    repositories: {
      answeredQuestions: { get: async () => undefined, insert: async () => undefined },
      repositoryIndexes: { recordQuestion: async (input: { id: string }) => { saved.push(input.id) } },
    },
    execution: { waitUntil(promise: Promise<unknown>) { pending.push(promise) } },
  } as unknown as GatewayContext
}

function chunk() {
  return {
    id: '9-abc:0',
    indexId: '9-abc',
    seq: 0,
    path: 'src/app.py',
    language: 'python',
    symbol: 'main',
    kind: 'function',
    startLine: 1,
    endLine: 2,
    content: 'def main():\n    return 1\n',
    identifiers: 'main',
  }
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<{ name: string; data: Record<string, unknown> }[]> {
  const text = await new Response(stream).text()
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const name = block.match(/^event: (.+)$/m)?.[1] ?? ''
      const data = block.match(/^data: (.+)$/m)?.[1] ?? '{}'
      return { name, data: JSON.parse(data) as Record<string, unknown> }
    })
}

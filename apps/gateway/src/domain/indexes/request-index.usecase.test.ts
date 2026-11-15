import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ERROR_CODE, INDEX_STATUS } from 'repotron-domain'

import type { GatewayEnv } from '../../env.ts'
import { gatewayStorage, type GatewayContext } from '../../context.ts'
import { RequestError } from '../../http-error.ts'
import { requestIndex } from './usecases/request-index.usecase.ts'

const config = {
  APP_ORIGIN: 'https://repotron.example',
  CLOUDFLARE_ACCOUNT_ID: 'account',
  AI_GATEWAY_ID: 'gateway',
  ANSWER_MODEL_ID: 'model',
  TURNSTILE_SECRET: 'turnstile',
  GITHUB_TOKEN: 'github',
  OPENROUTER_API_KEY: 'openrouter',
} satisfies GatewayEnv

describe('requestIndex', () => {
  it('when the link is not a repository, then the request is rejected and no index row is written', async () => {
    const written: string[] = []
    await assert.rejects(
      () => run(fetchQueue([json({ success: true })]), written, 'https://example.com/owner/repo'),
      (error: unknown) => error instanceof RequestError && error.code === ERROR_CODE.validationFailed,
    )
    assert.deepEqual(written, [])
  })

  it('when GitHub returns 404, then the repository is missing and no index row is written', async () => {
    const written: string[] = []
    const responses = [json({ success: true }), json({ message: 'Not Found' }, 404)]
    await assert.rejects(
      () => run(fetchQueue(responses), written, 'https://github.com/owner/private'),
      (error: unknown) => error instanceof RequestError && error.code === ERROR_CODE.repositoryNotFound,
    )
    assert.deepEqual(written, [])
  })

  it('when the tree is truncated, then the repository is too large', async () => {
    const written: string[] = []
    const responses = [
      json({ success: true }),
      json({ id: 9, private: false, size: 1, name: 'repo', default_branch: 'main', owner: { login: 'owner' } }),
      json({ commit: { sha: 'abc' } }),
      json({ truncated: true, tree: [] }),
    ]
    await assert.rejects(
      () => run(fetchQueue(responses), written, 'https://github.com/owner/repo'),
      (error: unknown) => error instanceof RequestError && error.code === ERROR_CODE.repositoryTooLarge,
    )
    assert.deepEqual(written, [])
  })

  it('when the repository is new, then the request returns 201 and one queued row', async () => {
    const written: string[] = []
    const responses = [
      json({ success: true }),
      json({ id: 9, private: false, size: 1, name: 'repo', default_branch: 'main', owner: { login: 'owner' } }),
      json({ commit: { sha: 'a'.repeat(40) } }),
      json({ truncated: false, tree: [{ type: 'blob' }] }),
    ]
    const result = await run(fetchQueue(responses), written, 'https://github.com/owner/repo')
    assert.equal(result.status, 201)
    assert.equal(result.index.status, INDEX_STATUS.queued)
    assert.deepEqual(written, [`9-${'a'.repeat(40)}`])
  })

  it('when the index failed, then the request resets it and restarts the workflow', async () => {
    const restarted: string[] = []
    const responses = [
      json({ success: true }),
      json({ id: 9, private: false, size: 1, name: 'repo', default_branch: 'main', owner: { login: 'owner' } }),
      json({ commit: { sha: 'b'.repeat(40) } }),
    ]
    const result = await run(fetchQueue(responses), [], 'https://github.com/owner/repo', `9-${'b'.repeat(40)}`, restarted, INDEX_STATUS.failed)
    assert.equal(result.status, 200)
    assert.equal(result.index.status, INDEX_STATUS.queued)
    assert.deepEqual(restarted, [`9-${'b'.repeat(40)}`])
  })

  it('when the index already exists, then the request returns 200 and writes no row', async () => {
    const written: string[] = []
    const id = `9-${'a'.repeat(40)}`
    const responses = [
      json({ success: true }),
      json({ id: 9, private: false, size: 1, name: 'repo', default_branch: 'main', owner: { login: 'owner' } }),
      json({ commit: { sha: 'a'.repeat(40) } }),
    ]
    const result = await run(fetchQueue(responses), written, 'https://github.com/owner/repo', id)
    assert.equal(result.status, 200)
    assert.deepEqual(written, [])
  })
})

async function run(
  fetchImpl: typeof fetch,
  written: string[],
  url: string,
  existingId?: string,
  restarted: string[] = [],
  existingStatus: string = INDEX_STATUS.ready,
) {
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    return await gatewayStorage.run(context(written, existingId, restarted, existingStatus), () =>
      requestIndex({ url, turnstileToken: 'token', remoteIp: '203.0.113.5' }),
    )
  } finally {
    globalThis.fetch = original
  }
}

function context(written: string[], existingId?: string, restarted: string[] = [], existingStatus: string = INDEX_STATUS.ready): GatewayContext {
  const rows = new Map<string, Record<string, unknown>>()
  if (existingId) {
    rows.set(existingId, {
      id: existingId,
      repositoryId: '9',
      commitSha: 'a'.repeat(40),
        status: existingStatus,
      failedStage: null,
      failureReason: null,
      fileCount: 1,
      chunkCount: 1,
      embeddingModelId: 'model',
      createdAt: 1,
      updatedAt: 1,
      readyAt: 1,
      lastQuestionAt: null,
    })
  }
  return {
    config,
    repositories: {
      repositoryIndexes: {
        get: async (id: string) => rows.get(id),
        insertQueued: async (input: { id: string; repositoryId: string; commitSha: string }) => {
          written.push(input.id)
          rows.set(input.id, {
            ...input,
            status: INDEX_STATUS.queued,
            failedStage: null,
            failureReason: null,
            fileCount: null,
            chunkCount: null,
            createdAt: 1,
            updatedAt: 1,
            readyAt: null,
            lastQuestionAt: null,
          })
        },
        findNewestReady: async () => undefined,
        resetToQueued: async (input: { id: string }) => {
          const row = rows.get(input.id)
          if (row) row.status = INDEX_STATUS.queued
        },
      },
      githubRepositories: { upsert: async () => undefined },
    },
    repositoryIndexing: {
      create: async () => undefined,
      get: (id: string) => ({
        restart: async () => {
          restarted.push(id)
        },
      }),
    },
    rateLimiter: { getByName: () => ({ consume: async () => ({ allowed: true }) }) },
    execution: { waitUntil() {} },
  } as unknown as GatewayContext
}

function fetchQueue(responses: Response[]): typeof fetch {
  const pending = [...responses]
  return (async () => {
    const response = pending.shift()
    if (!response) throw new Error('Unexpected fetch.')
    return response
  }) as typeof fetch
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

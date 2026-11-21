import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { EVAL_PATH } from './endpoints'
import { HttpClient } from './http-client'

type SeenCall = { method: string; path: string }

type HttpClientDouble = Pick<HttpClient, 'get' | 'post' | 'postStream'>

let activeClient: HttpClientDouble | undefined

mock.module('./client', {
  namedExports: {
    getHttpClient(): HttpClientDouble {
      if (!activeClient) throw new Error('The test HTTP client is missing.')
      return activeClient
    },
  },
})

const { listEvalSummaries } = await import('./evals.service')

function useRecordingClient(response: unknown): SeenCall[] {
  const seen: SeenCall[] = []
  activeClient = {
    async get<T>(path: string): Promise<T> {
      seen.push({ method: 'get', path })
      return response as T
    },
    async post<T>(): Promise<T> {
      throw new Error('The eval service posts nothing.')
    },
    async postStream(): Promise<ReadableStream<Uint8Array>> {
      throw new Error('The eval service opens no stream.')
    },
  }
  return seen
}

describe('evals service', () => {
  it('when listEvalSummaries runs, then it returns the summaries from the evals path', async () => {
    const seen = useRecordingClient({ evals: [{ commitSha: 'abc' }] })

    const evals = await listEvalSummaries()

    assert.deepEqual(seen, [{ method: 'get', path: EVAL_PATH }])
    assert.deepEqual(evals, [{ commitSha: 'abc' }])
  })
})

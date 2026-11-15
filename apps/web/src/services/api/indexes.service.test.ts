import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { INDEX_PATH } from './endpoints'
import { HttpClient } from './http-client'

type SeenCall = { method: string; path: string; body: unknown }

/** The three calls a service makes. A recording double has no private state. */
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

const { listRecentIndexes, readIndex, requestIndex } = await import('./indexes.service')

/** Gives the service a client that records each call and answers with one fixed response. */
function useRecordingClient(response: unknown): SeenCall[] {
  const seen: SeenCall[] = []
  activeClient = {
    async get<T>(path: string): Promise<T> {
      seen.push({ method: 'get', path, body: undefined })
      return response as T
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      seen.push({ method: 'post', path, body })
      return response as T
    },
    async postStream(): Promise<ReadableStream<Uint8Array>> {
      throw new Error('The indexes service opens no stream.')
    },
  }
  return seen
}

describe('indexes service', () => {
  it('when requestIndex runs, then it posts the link and the token to the indexes path', async () => {
    const seen = useRecordingClient({ id: 'index-1' })
    const body = { url: 'https://github.com/honojs/hono', turnstileToken: 'token-1' }

    await requestIndex(body)

    assert.deepEqual(seen, [{ method: 'post', path: INDEX_PATH.LIST, body }])
  })

  it('when readIndex runs, then it gets the path of that index', async () => {
    const seen = useRecordingClient({ id: 'index-1' })

    await readIndex('438384984-f6fbaf0')

    assert.deepEqual(seen, [{ method: 'get', path: INDEX_PATH.byId('438384984-f6fbaf0'), body: undefined }])
  })

  it('when listRecentIndexes runs, then it returns the indexes of the response', async () => {
    useRecordingClient({ indexes: [{ id: 'index-1' }] })

    const indexes = await listRecentIndexes()

    assert.deepEqual(indexes, [{ id: 'index-1' }])
  })
})

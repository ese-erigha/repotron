import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ApiError, HttpClient, NETWORK_ERROR_CODE } from './http-client'

const ORIGIN = 'https://gateway.example'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

describe('http client', () => {
  it('when the response holds the error envelope, then the error keeps its code and message', async (t) => {
    const envelope = { error: { code: 'repository_not_found', message: 'This repository does not exist or is private.' } }
    t.mock.method(globalThis, 'fetch', async () => jsonResponse(404, envelope))
    const client = new HttpClient(ORIGIN)

    const failure = client.get('/api/v1/indexes/missing')

    await assert.rejects(failure, (error: ApiError) => {
      assert.equal(error.code, 'repository_not_found')
      assert.equal(error.message, 'This repository does not exist or is private.')
      assert.equal(error.status, 404)
      return true
    })
  })

  it('when a 429 response has Retry-After, then the error sets retryAfterSeconds', async (t) => {
    const envelope = { error: { code: 'rate_limited', message: 'The hourly limit is reached.' } }
    t.mock.method(globalThis, 'fetch', async () => jsonResponse(429, envelope, { 'Retry-After': '1740' }))
    const client = new HttpClient(ORIGIN)

    const failure = client.post('/api/v1/indexes', {})

    await assert.rejects(failure, (error: ApiError) => {
      assert.equal(error.retryAfterSeconds, 1740)
      return true
    })
  })

  it('when the error body is not the envelope, then the error code is internal', async (t) => {
    const page = new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' })
    t.mock.method(globalThis, 'fetch', async () => page)
    const client = new HttpClient(ORIGIN)

    const failure = client.get('/api/v1/indexes')

    await assert.rejects(failure, (error: ApiError) => {
      assert.equal(error.code, 'internal')
      assert.equal(error.message, 'Bad Gateway')
      return true
    })
  })

  it('when no response arrives, then the error code is network', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    const client = new HttpClient(ORIGIN)

    const failure = client.get('/api/v1/indexes')

    await assert.rejects(failure, (error: ApiError) => {
      assert.equal(error.code, NETWORK_ERROR_CODE)
      assert.equal(error.status, 0)
      return true
    })
  })

  it('when the caller aborts the request, then the AbortError passes through unchanged', async (t) => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    t.mock.method(globalThis, 'fetch', async () => {
      throw abort
    })
    const client = new HttpClient(ORIGIN)

    const failure = client.postStream('/api/v1/indexes/1/questions', {}, new AbortController().signal)

    await assert.rejects(failure, (error: unknown) => error === abort)
  })

  it('when postStream gets a 201, then it returns the response body', async (t) => {
    const stream = new Response('event: token\ndata: {"text":"Hi"}\n\n', { status: 201 })
    t.mock.method(globalThis, 'fetch', async () => stream)
    const client = new HttpClient(ORIGIN)

    const body = await client.postStream('/api/v1/indexes/1/questions', {}, new AbortController().signal)

    assert.equal(body, stream.body)
  })

  it('when get runs, then it requests the base URL joined with the path', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse(200, { ok: true }))
    const client = new HttpClient(ORIGIN)

    await client.get('/api/v1/indexes')

    assert.equal(fetchMock.mock.calls[0]?.arguments[0], `${ORIGIN}/api/v1/indexes`)
  })
})

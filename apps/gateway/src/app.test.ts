import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ERROR_CODE } from 'repotron-domain'

import app from './app.ts'

const ORIGIN = 'https://repotron.example'
const env = {
  APP_ORIGIN: ORIGIN,
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

describe('gateway', () => {
  it('when the health path is requested, then the gateway returns ok', async () => {
    const response = await app.request('/health', {}, env)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  })

  it('when the path is unknown, then the gateway returns the not found envelope', async () => {
    const response = await app.request('/api/v1/unknown', {}, env)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: { code: ERROR_CODE.notFound, message: 'The resource was not found.' },
    })
  })

  it('when a request comes from the web origin, then the response allows that origin', async () => {
    const response = await app.request(
      '/api/v1/indexes',
      { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } },
      env,
    )
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN)
  })

  it('when a request comes from another origin, then the response has no allow-origin header', async () => {
    const response = await app.request(
      '/health',
      { headers: { Origin: 'https://other.example' } },
      env,
    )
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  })
})

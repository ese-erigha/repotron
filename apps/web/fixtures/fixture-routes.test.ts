import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildIndexId, indexViewSchema, SYMBOL_HIT_ROLE } from 'repotron-domain'

import { answerRequest } from './fixture-routes.ts'
import { FixtureStore } from './fixture-store.ts'

const NOW = 1_794_700_000_000

describe('fixture routes', () => {
  it('when the recent list is requested, then the body matches the gateway list', async () => {
    const store = new FixtureStore(NOW)

    const response = await answerRequest(store, new Request('http://fixture/indexes'))

    const body = (await response.json()) as { indexes: unknown[] }
    assert.equal(response.status, 200)
    assert.deepEqual(indexViewSchema.array().parse(body.indexes), body.indexes)
  })

  it('when the index id is missing, then the response is the gateway not-found envelope', async () => {
    const store = new FixtureStore(NOW)

    const response = await answerRequest(store, new Request('http://fixture/indexes/missing'))

    assert.deepEqual(await response.json(), {
      error: { code: 'not_found', message: 'The index does not exist.' },
    })
    assert.equal(response.status, 404)
  })

  it('when a symbol is traced, then the definition comes before a usage', async () => {
    const store = new FixtureStore(NOW)
    const indexId = buildIndexId('438384984', 'f6fbaf0299c48eea9e656e03e2ffe7ac755e8823')

    const response = await answerRequest(store, new Request(`http://fixture/indexes/${indexId}/symbols/Hono`))
    const body = (await response.json()) as { hits: { role: string }[] }

    assert.equal(response.status, 200)
    assert.equal(body.hits[0]?.role, SYMBOL_HIT_ROLE.definition)
  })
})
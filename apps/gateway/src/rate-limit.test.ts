import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RATE_LIMIT_KIND } from 'repotron-domain'

import { consumeRateLimit, type CountStore } from './rate-limit.ts'

describe('consumeRateLimit', () => {
  it('when the RateLimiter has already counted 5 index requests this hour, then the sixth is refused', async () => {
    const store = memoryStore()
    const now = Date.parse('2026-01-01T00:10:00.000Z')
    for (let count = 0; count < 5; count += 1) {
      const decision = await consumeRateLimit({ store, kind: RATE_LIMIT_KIND.index, now })
      assert.equal(decision.allowed, true)
    }
    const refused = await consumeRateLimit({ store, kind: RATE_LIMIT_KIND.index, now })
    assert.equal(refused.allowed, false)
    if (!refused.allowed) assert.equal(refused.retryAfterSeconds, 50 * 60)
  })
})

function memoryStore(): CountStore {
  const values = new Map<string, number>()
  return {
    async get(key) {
      return values.get(key)
    },
    async put(key, value) {
      values.set(key, value)
    },
  }
}

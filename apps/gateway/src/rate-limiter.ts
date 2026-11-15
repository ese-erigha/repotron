import { DurableObject } from 'cloudflare:workers'
import type { RateLimitKind } from 'repotron-domain'

import { consumeRateLimit, type RateLimitDecision } from './rate-limit.ts'

export class RateLimiter extends DurableObject<Record<string, unknown>> {
  async consume(kind: RateLimitKind): Promise<RateLimitDecision> {
    return consumeRateLimit({
      store: {
        get: (key) => this.ctx.storage.get<number>(key),
        put: (key, value) => this.ctx.storage.put(key, value),
      },
      kind,
      now: Date.now(),
    })
  }
}

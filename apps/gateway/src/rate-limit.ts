import {
  INDEX_REQUESTS_PER_HOUR,
  QUESTIONS_PER_HOUR,
  RATE_LIMIT_KIND,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitKind,
} from 'repotron-domain'

export type CountStore = {
  get(key: string): Promise<number | undefined>
  put(key: string, value: number): Promise<void>
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export async function consumeRateLimit(input: {
  store: CountStore
  kind: RateLimitKind
  now: number
}): Promise<RateLimitDecision> {
  const windowStart = input.now - (input.now % RATE_LIMIT_WINDOW_MS)
  const count = (await input.store.get(`${input.kind}:${windowStart}`)) ?? 0
  const limit = input.kind === RATE_LIMIT_KIND.index ? INDEX_REQUESTS_PER_HOUR : QUESTIONS_PER_HOUR
  if (count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - input.now) / 1000))
    return { allowed: false, retryAfterSeconds }
  }
  await input.store.put(`${input.kind}:${windowStart}`, count + 1)
  return { allowed: true }
}

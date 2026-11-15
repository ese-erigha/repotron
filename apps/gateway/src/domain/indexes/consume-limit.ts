import { ERROR_CODE, RATE_LIMIT_KIND, type RateLimitKind } from 'repotron-domain'

import { getRateLimiter } from '../../context.ts'
import { RequestError } from '../../http-error.ts'

export async function consumeLimit(kind: RateLimitKind, remoteIp: string): Promise<void> {
  if (remoteIp === '') throw new RequestError(400, ERROR_CODE.validationFailed, 'The client address is missing.')
  const decision = await getRateLimiter().getByName(remoteIp).consume(kind)
  if (decision.allowed) return
  throw new RequestError(429, ERROR_CODE.rateLimited, 'The hourly limit is reached.', decision.retryAfterSeconds)
}

export { RATE_LIMIT_KIND }

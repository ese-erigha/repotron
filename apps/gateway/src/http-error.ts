import type { Context } from 'hono'
import { log } from 'log'
import { ERROR_CODE, type ErrorCode } from 'repotron-domain'
import type { ZodType } from 'zod'

type HttpStatus = 400 | 403 | 404 | 409 | 429 | 500 | 503

export class RequestError extends Error {
  readonly status: HttpStatus
  readonly code: ErrorCode
  readonly retryAfterSeconds?: number

  constructor(status: HttpStatus, code: ErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function parseRequest<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    log.error('request_invalid', parsed.error)
    throw new RequestError(400, ERROR_CODE.validationFailed, 'The request is invalid.')
  }
  return parsed.data
}

export function handleErrors(c: Context, error: unknown): Response {
  if (error instanceof RequestError) {
    if (error.retryAfterSeconds !== undefined) c.header('Retry-After', String(error.retryAfterSeconds))
    return c.json({ error: { code: error.code, message: error.message } }, error.status)
  }
  log.error('gateway_failed', error)
  return c.json({ error: { code: ERROR_CODE.internal, message: 'Something went wrong.' } }, 500)
}

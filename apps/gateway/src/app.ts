import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { ERROR_CODE } from 'repotron-domain'

import { gatewayContext, gatewayStorage } from './context.ts'
import indexes from './domain/indexes/indexes.controller.ts'
import questions from './domain/questions/questions.controller.ts'
import { handleErrors, RequestError } from './http-error.ts'

const API_BASE = '/api/v1'

const app = new Hono()

app.use('*', async (c, next) => {
  const env = c.env as Record<string, unknown>
  const origin = typeof env.APP_ORIGIN === 'string' ? env.APP_ORIGIN : ''
  const middleware = cors({
    origin,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['Retry-After'],
    credentials: false,
    maxAge: 600,
  })
  return middleware(c, next)
})

app.use(`${API_BASE}/*`, async (c, next) => {
  await gatewayStorage.run(gatewayContext(c.env as Record<string, unknown>, executionOf(c)), next)
})

function executionOf(c: Context): { waitUntil(promise: Promise<unknown>): void } {
  try {
    return c.executionCtx
  } catch (error) {
    if (error instanceof Error && error.message.includes('ExecutionContext')) return { waitUntil() {} }
    throw error
  }
}

app.onError((error, c) => handleErrors(c, error))
app.get('/health', readHealth)
app.route(`${API_BASE}/indexes`, indexes)
app.route(`${API_BASE}/questions`, questions)
app.all(`${API_BASE}/*`, missingRoute)

function readHealth(c: Context): Response {
  return c.json({ ok: true })
}

function missingRoute(): never {
  throw new RequestError(404, ERROR_CODE.notFound, 'The resource was not found.')
}

export default app

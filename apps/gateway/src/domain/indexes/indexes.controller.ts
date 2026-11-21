import { Hono } from 'hono'

import { parseRequest } from '../../http-error.ts'
import { requestIndexSchema } from './indexes.schema.ts'
import { listRecentIndexes } from './usecases/list-recent-indexes.usecase.ts'
import { readIndex } from './usecases/read-index.usecase.ts'
import { requestIndex } from './usecases/request-index.usecase.ts'
import { questionBodySchema } from '../questions/questions.schema.ts'
import { askQuestion } from '../questions/usecases/ask-question.usecase.ts'

const EVAL_TOKEN_HEADER = 'x-repotron-eval-token'

const indexes = new Hono()

indexes.post('/', async (c) => {
  const body = parseRequest(requestIndexSchema, await c.req.json())
  const result = await requestIndex({
    url: body.url,
    turnstileToken: body.turnstileToken,
    remoteIp: c.req.header('CF-Connecting-IP') ?? '',
  })
  return c.json(result.index, result.status)
})

indexes.get('/', async (c) => {
  const result = await listRecentIndexes()
  return c.json(result)
})

indexes.get('/:id', async (c) => {
  const index = await readIndex(c.req.param('id'))
  return c.json(index)
})

indexes.post('/:id/questions', async (c) => {
  const body = parseRequest(questionBodySchema, await c.req.json())
  const stream = await askQuestion({
    indexId: c.req.param('id'),
    body,
    remoteIp: c.req.header('CF-Connecting-IP') ?? '',
    evalToken: c.req.header(EVAL_TOKEN_HEADER) ?? '',
    retrieval: c.req.query('retrieval') ?? '',
  })
  return new Response(stream, {
    status: 201,
    headers: { 'content-type': 'text/event-stream' },
  })
})

export default indexes

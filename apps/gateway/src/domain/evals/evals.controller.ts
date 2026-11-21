import { Hono } from 'hono'

import { listEvalSummaries } from './usecases/list-eval-summaries.usecase.ts'

const evals = new Hono()

evals.get('/', async (c) => {
  const result = await listEvalSummaries()
  return c.json(result)
})

export default evals

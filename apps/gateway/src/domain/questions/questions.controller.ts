import { Hono } from 'hono'

import { readQuestion } from './usecases/read-question.usecase.ts'

const questions = new Hono()

questions.get('/:id', async (c) => {
  const question = await readQuestion(c.req.param('id'))
  return c.json(question)
})

export default questions

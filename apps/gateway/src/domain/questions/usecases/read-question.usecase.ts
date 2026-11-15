import { ERROR_CODE, questionViewSchema, type QuestionView } from 'repotron-domain'

import { getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'

export async function readQuestion(questionId: string): Promise<QuestionView> {
  const row = await getRepositories().answeredQuestions.get(questionId)
  if (!row) throw new RequestError(404, ERROR_CODE.notFound, 'This answer does not exist.')
  const citations: unknown = JSON.parse(row.citations)
  return questionViewSchema.parse({
    id: row.id,
    repositoryFullName: row.repositoryFullName,
    commitSha: row.commitSha,
    preset: row.preset,
    question: row.question,
    answer: row.answer,
    citations,
    createdAt: row.createdAt,
  })
}

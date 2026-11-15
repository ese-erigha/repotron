import type { QuestionView } from 'repotron-domain'

import { getHttpClient } from './client'
import { QUESTION_PATH } from './endpoints'

/** Reads one stored answer with its question and its cited sources. */
export async function readQuestion(questionId: string): Promise<QuestionView> {
  return getHttpClient().get<QuestionView>(QUESTION_PATH.byId(questionId))
}

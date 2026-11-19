import { explainFeatureQuestion, PRESET, PRESET_QUESTION, type Language } from 'repotron-domain'

import type { QuestionBody } from '../services/api/answer-stream.service'

export type QuestionScope = {
  language?: Language
  pathPrefix?: string
}

/** One question for the answer stream: the request body, and the text that the answer shows above it. */
export type AskRequest = {
  body: QuestionBody
  label: string
}

export function questionRequest(question: string, scope?: QuestionScope): AskRequest {
  const body: QuestionBody = { question }
  if (scope?.language) body.language = scope.language
  if (scope?.pathPrefix) body.pathPrefix = scope.pathPrefix
  return { body, label: question }
}

export function startHereRequest(): AskRequest {
  return { body: { preset: PRESET.startHere }, label: PRESET_QUESTION[PRESET.startHere] }
}

export function explainFeatureRequest(featureName: string): AskRequest {
  return { body: { preset: PRESET.explainFeature, featureName }, label: explainFeatureQuestion(featureName) }
}

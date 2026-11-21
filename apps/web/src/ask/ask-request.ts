import { explainFeatureQuestion, PRESET, PRESET_QUESTION } from 'repotron-domain'

import type { QuestionBody } from '../services/api/answer-stream.service'

/** One question for the answer stream: the request body, and the text that the answer shows above it. */
export type AskRequest = {
  body: QuestionBody
  label: string
}

export function questionRequest(question: string): AskRequest {
  return { body: { question }, label: question }
}

export function startHereRequest(): AskRequest {
  return { body: { preset: PRESET.startHere }, label: PRESET_QUESTION[PRESET.startHere] }
}

export function explainFeatureRequest(featureName: string): AskRequest {
  return { body: { preset: PRESET.explainFeature, featureName }, label: explainFeatureQuestion(featureName) }
}

import {
  explainFeatureQuestion,
  NOT_FOUND_ANSWER,
  PRESET,
  PRESET_QUESTION,
  type Preset,
} from 'repotron-domain'

import type { FixtureAnswer, FixtureRepository, KeywordAnswer } from './data/fixture-repository.ts'
import { QUESTION_SCENARIO } from './scenarios.ts'

export type QuestionBody =
  | { question: string }
  | { preset: typeof PRESET.startHere }
  | { preset: typeof PRESET.explainFeature; featureName: string }

export type ScriptedAnswer = FixtureAnswer & {
  question: string
  preset: Preset | null
}

const LONG_ANSWER_REPEATS = 4

/** Picks the fixture answer for a question, as the retrieval and the model do in production. */
export function scriptAnswer(repository: FixtureRepository, body: QuestionBody): ScriptedAnswer {
  if (!('preset' in body)) {
    return { ...freeAnswer(repository, body.question), question: body.question, preset: null }
  }
  if (body.preset === PRESET.startHere) {
    return { ...repository.startHere, question: PRESET_QUESTION[PRESET.startHere], preset: body.preset }
  }
  const feature = findByKeyword(repository.features, body.featureName) ?? notFoundAnswer(repository)
  return { ...feature, question: explainFeatureQuestion(body.featureName), preset: body.preset }
}

function freeAnswer(repository: FixtureRepository, question: string): FixtureAnswer {
  if (question === QUESTION_SCENARIO.none) return notFoundAnswer(repository)
  if (question === QUESTION_SCENARIO.long) return longAnswer(repository)
  return findByKeyword(repository.topics, question) ?? repository.overview
}

function findByKeyword(answers: readonly KeywordAnswer[], text: string): FixtureAnswer | undefined {
  const words = text.toLowerCase()
  return answers.find((answer) => answer.keywords.some((keyword) => words.includes(keyword)))
}

/** Retrieval still returns chunks. The model states that they do not hold the answer. */
function notFoundAnswer(repository: FixtureRepository): FixtureAnswer {
  return { sources: repository.overview.sources, text: NOT_FOUND_ANSWER }
}

function longAnswer(repository: FixtureRepository): FixtureAnswer {
  const parts = Array.from({ length: LONG_ANSWER_REPEATS }, () => repository.overview.text)
  return { sources: repository.overview.sources, text: parts.join('\n\n') }
}

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { NOT_FOUND_ANSWER, PRESET } from 'repotron-domain'

import { scriptAnswer } from './answer-script.ts'
import { HONO_REPOSITORY } from './data/hono.fixture.ts'
import { QUESTION_SCENARIO } from './scenarios.ts'

describe('scriptAnswer', () => {
  it('when the question holds a topic keyword, then the answer is the answer of that topic', () => {
    const answer = scriptAnswer(HONO_REPOSITORY, { question: 'How does middleware run?' })

    assert.equal(answer.text, HONO_REPOSITORY.topics[0]?.text)
  })

  it('when the question matches no topic, then the answer is the overview', () => {
    const answer = scriptAnswer(HONO_REPOSITORY, { question: 'What is this?' })

    assert.equal(answer.text, HONO_REPOSITORY.overview.text)
  })

  it('when the start preset is asked, then the answer has the preset and its fixed question', () => {
    const answer = scriptAnswer(HONO_REPOSITORY, { preset: PRESET.startHere })

    assert.deepEqual(
      { question: answer.question, preset: answer.preset, text: answer.text },
      { question: 'Where do I start?', preset: PRESET.startHere, text: HONO_REPOSITORY.startHere.text },
    )
  })

  it('when the feature preset names a known feature, then the question holds the feature name', () => {
    const answer = scriptAnswer(HONO_REPOSITORY, { preset: PRESET.explainFeature, featureName: 'CORS' })

    assert.deepEqual(
      { question: answer.question, text: answer.text },
      { question: 'Explain this feature. Feature: CORS', text: HONO_REPOSITORY.features[0]?.text },
    )
  })

  it('when the feature preset names an unknown feature, then the answer states that it was not found', () => {
    const answer = scriptAnswer(HONO_REPOSITORY, { preset: PRESET.explainFeature, featureName: 'billing' })

    assert.equal(answer.text, NOT_FOUND_ANSWER)
  })

  it('when the question is the not-found scenario, then the answer keeps the sources of the retrieval', () => {
    const answer = scriptAnswer(HONO_REPOSITORY, { question: QUESTION_SCENARIO.none })

    assert.deepEqual(
      { text: answer.text, sources: answer.sources },
      { text: NOT_FOUND_ANSWER, sources: HONO_REPOSITORY.overview.sources },
    )
  })
})

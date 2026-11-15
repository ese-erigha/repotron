import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Citation } from 'repotron-domain'

import {
  ANSWER_ACTION,
  ANSWER_PHASE,
  INITIAL_ANSWER_STATE,
  reduceAnswerStream,
  type AnswerStreamState,
} from './answer-stream-state'

const CITATION: Citation = {
  number: 1,
  path: 'src/hono.ts',
  startLine: 16,
  endLine: 34,
  symbol: 'Hono',
  kind: 'class',
  content: 'export class Hono {}',
  githubUrl: 'https://github.com/honojs/hono/blob/f6fbaf0/src/hono.ts#L16-L34',
}

const STREAMING: AnswerStreamState = {
  ...INITIAL_ANSWER_STATE,
  phase: ANSWER_PHASE.STREAMING,
  question: 'Where is the router created?',
  citations: [CITATION],
  text: 'The `Hono` constructor',
}

describe('answer stream state', () => {
  it('when a question starts, then the reducer clears the earlier answer and waits', () => {
    const state = reduceAnswerStream(STREAMING, { type: ANSWER_ACTION.STARTED, question: 'How does CORS work?' })

    assert.deepEqual(state, {
      ...INITIAL_ANSWER_STATE,
      phase: ANSWER_PHASE.WAITING,
      question: 'How does CORS work?',
    })
  })

  it('when a token arrives while streaming, then the reducer appends its text', () => {
    const state = reduceAnswerStream(STREAMING, { type: ANSWER_ACTION.TOKEN, text: ' creates the router [1].' })

    assert.equal(state.text, 'The `Hono` constructor creates the router [1].')
  })

  it('when the first token arrives after the retrieval, then the phase is streaming', () => {
    const retrieved: AnswerStreamState = { ...STREAMING, phase: ANSWER_PHASE.RETRIEVED, text: '' }

    const state = reduceAnswerStream(retrieved, { type: ANSWER_ACTION.TOKEN, text: 'The' })

    assert.equal(state.phase, ANSWER_PHASE.STREAMING)
  })

  it('when the done event arrives, then the reducer keeps the question id for the share link', () => {
    const state = reduceAnswerStream(STREAMING, { type: ANSWER_ACTION.DONE, questionId: 'question-1', answerMs: 2400 })

    assert.deepEqual(
      { phase: state.phase, questionId: state.questionId, answerMs: state.answerMs },
      { phase: ANSWER_PHASE.DONE, questionId: 'question-1', answerMs: 2400 },
    )
  })

  it('when an error event arrives, then the reducer keeps the sources and moves to failed', () => {
    const error = { code: 'internal', message: 'The answer model failed.' } as const

    const state = reduceAnswerStream(STREAMING, { type: ANSWER_ACTION.FAILED, error })

    assert.deepEqual(
      { phase: state.phase, citations: state.citations, error: state.error },
      { phase: ANSWER_PHASE.FAILED, citations: [CITATION], error },
    )
  })
})

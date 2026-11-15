import type { Citation } from 'repotron-domain'

import type { ErrorDetail } from '../ui/error-text'

export const ANSWER_PHASE = {
  /** No question yet. */
  IDLE: 'idle',
  /** The question is sent. The sources did not arrive. */
  WAITING: 'waiting',
  /** The sources arrived. The first token did not. */
  RETRIEVED: 'retrieved',
  STREAMING: 'streaming',
  DONE: 'done',
  FAILED: 'failed',
} as const

export type AnswerPhase = (typeof ANSWER_PHASE)[keyof typeof ANSWER_PHASE]

export type AnswerStreamState = {
  phase: AnswerPhase
  /** The question text that the answer shows above it. */
  question: string
  citations: Citation[]
  text: string
  /** The id for the share link. The `done` event carries it. */
  questionId: string | null
  answerMs: number | null
  error: ErrorDetail | null
}

export const ANSWER_ACTION = {
  STARTED: 'started',
  RETRIEVAL: 'retrieval',
  TOKEN: 'token',
  DONE: 'done',
  FAILED: 'failed',
  RESET: 'reset',
} as const

export type AnswerStreamAction =
  | { type: typeof ANSWER_ACTION.STARTED; question: string }
  | { type: typeof ANSWER_ACTION.RETRIEVAL; citations: Citation[] }
  | { type: typeof ANSWER_ACTION.TOKEN; text: string }
  | { type: typeof ANSWER_ACTION.DONE; questionId: string; answerMs: number }
  | { type: typeof ANSWER_ACTION.FAILED; error: ErrorDetail }
  | { type: typeof ANSWER_ACTION.RESET }

export const INITIAL_ANSWER_STATE: AnswerStreamState = {
  phase: ANSWER_PHASE.IDLE,
  question: '',
  citations: [],
  text: '',
  questionId: null,
  answerMs: null,
  error: null,
}

/** Moves the ask panel through the events of one answer stream. */
export function reduceAnswerStream(state: AnswerStreamState, action: AnswerStreamAction): AnswerStreamState {
  switch (action.type) {
    case ANSWER_ACTION.STARTED:
      return { ...INITIAL_ANSWER_STATE, phase: ANSWER_PHASE.WAITING, question: action.question }
    case ANSWER_ACTION.RETRIEVAL:
      return { ...state, phase: ANSWER_PHASE.RETRIEVED, citations: action.citations }
    case ANSWER_ACTION.TOKEN:
      return { ...state, phase: ANSWER_PHASE.STREAMING, text: state.text + action.text }
    case ANSWER_ACTION.DONE:
      return { ...state, phase: ANSWER_PHASE.DONE, questionId: action.questionId, answerMs: action.answerMs }
    case ANSWER_ACTION.FAILED:
      // The sources and the text that arrived stay, so the user keeps what the stream sent.
      return { ...state, phase: ANSWER_PHASE.FAILED, error: action.error }
    case ANSWER_ACTION.RESET:
      return INITIAL_ANSWER_STATE
  }
}

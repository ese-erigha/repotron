import { useCallback, useEffect, useReducer, useRef } from 'react'
import { STREAM_EVENT } from 'repotron-domain'

import { openAnswerStream, type AnswerStreamEvent } from '../services/api/answer-stream.service'
import { asApiError } from '../services/api/http-client'
import {
  ANSWER_ACTION,
  INITIAL_ANSWER_STATE,
  reduceAnswerStream,
  type AnswerStreamAction,
  type AnswerStreamState,
} from './answer-stream-state'
import type { AskRequest } from './ask-request'

export type AnswerStream = {
  answer: AnswerStreamState
  /** Asks a question. It aborts the stream of the earlier question. */
  ask(request: AskRequest): Promise<void>
}

/** Streams the answer to one question at a time for an index. A change of the index clears the answer. */
export function useAnswerStream(indexId: string | null): AnswerStream {
  const [answer, dispatch] = useReducer(reduceAnswerStream, INITIAL_ANSWER_STATE)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    dispatch({ type: ANSWER_ACTION.RESET })
    return () => controllerRef.current?.abort()
  }, [indexId])

  const ask = useCallback(
    async (request: AskRequest) => {
      if (indexId === null) return
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      dispatch({ type: ANSWER_ACTION.STARTED, question: request.label })
      for await (const action of readAnswerActions(indexId, request, controller.signal)) {
        // A newer question, or a change of the index, aborted this stream. Its events are stale.
        if (controller.signal.aborted) return
        dispatch(action)
      }
    },
    [indexId],
  )

  return { answer, ask }
}

/** Turns the events of one answer stream into reducer actions. A failure is the last action. */
async function* readAnswerActions(
  indexId: string,
  request: AskRequest,
  signal: AbortSignal,
): AsyncGenerator<AnswerStreamAction> {
  let hasEnded = false
  try {
    for await (const event of openAnswerStream(indexId, request.body, signal)) {
      hasEnded = event.name === STREAM_EVENT.done || event.name === STREAM_EVENT.error
      yield toAction(event)
    }
  } catch (failure) {
    yield { type: ANSWER_ACTION.FAILED, error: asApiError(failure) }
    return
  }
  // A stream that closes with no `done` event and no `error` event lost its connection.
  if (!hasEnded) yield { type: ANSWER_ACTION.FAILED, error: asApiError(new Error('The answer stream closed early.')) }
}

function toAction(event: AnswerStreamEvent): AnswerStreamAction {
  switch (event.name) {
    case STREAM_EVENT.retrieval:
      return { type: ANSWER_ACTION.RETRIEVAL, citations: event.data.citations }
    case STREAM_EVENT.token:
      return { type: ANSWER_ACTION.TOKEN, text: event.data.text }
    case STREAM_EVENT.done:
      return { type: ANSWER_ACTION.DONE, questionId: event.data.questionId, answerMs: event.data.answerMs }
    case STREAM_EVENT.error:
      return { type: ANSWER_ACTION.FAILED, error: event.data }
  }
}

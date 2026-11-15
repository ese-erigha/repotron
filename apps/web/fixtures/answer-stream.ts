import { setTimeout as wait } from 'node:timers/promises'

import { ERROR_CODE, STREAM_EVENT, type DoneEvent, type StreamEventName } from 'repotron-domain'

import type { ScriptedAnswer } from './answer-script.ts'
import type { AnsweredQuestion, FixtureStore, StoredIndex } from './fixture-store.ts'
import { FIXTURE_DELAY_MS, MODEL_FAILURE_MESSAGE } from './scenarios.ts'
import { eventBytes } from './send-response.ts'

const CHARACTERS_PER_TOKEN = 4
const FAILURE_POINT = 0.4
const STREAM_HEADERS = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }

export type AnswerStreamInput = {
  index: StoredIndex
  answer: ScriptedAnswer
  isSlow: boolean
  failsMidway: boolean
}

type SendEvent = (name: StreamEventName, data: unknown) => void

/** The events of one answer, in the order of the gateway: retrieval, tokens, then done or error. */
export function streamAnswer(store: FixtureStore, input: AnswerStreamInput, signal: AbortSignal): Response {
  const body = new ReadableStream({
    async start(controller) {
      const send: SendEvent = (name, data) => controller.enqueue(eventBytes(name, data))
      try {
        await writeAnswer(store, input, signal, send)
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body, { status: 201, headers: STREAM_HEADERS })
}

async function writeAnswer(
  store: FixtureStore,
  input: AnswerStreamInput,
  signal: AbortSignal,
  send: SendEvent,
): Promise<void> {
  const startedAt = Date.now()
  const citations = store.citationsOf(input.index, input.answer.sources)
  await wait(input.isSlow ? FIXTURE_DELAY_MS.slowRetrieval : FIXTURE_DELAY_MS.retrieval)
  if (signal.aborted) return
  send(STREAM_EVENT.retrieval, { citations })
  const retrievalMs = Date.now() - startedAt
  await wait(input.isSlow ? FIXTURE_DELAY_MS.slowFirstToken : FIXTURE_DELAY_MS.firstToken)
  if (signal.aborted) return
  const firstTokenMs = Date.now() - startedAt
  const isComplete = await writeTokens(input, signal, send)
  if (!isComplete) return
  const done: DoneEvent = {
    questionId: crypto.randomUUID().replaceAll('-', ''),
    inputTokens: countTokens(citations.map((citation) => citation.content).join('')),
    outputTokens: countTokens(input.answer.text),
    retrievalMs,
    firstTokenMs,
    answerMs: Date.now() - startedAt,
  }
  send(STREAM_EVENT.done, done)
  const answered: AnsweredQuestion = {
    id: done.questionId,
    index: input.index,
    answer: input.answer,
    citations,
    createdAt: Date.now(),
  }
  store.saveQuestion(answered)
}

/** Returns false when the stream stopped early: the browser left, or the scenario fails the model. */
async function writeTokens(input: AnswerStreamInput, signal: AbortSignal, send: SendEvent): Promise<boolean> {
  const pieces = input.answer.text.match(/\S+\s*|\s+/g) ?? []
  const failureIndex = input.failsMidway ? Math.floor(pieces.length * FAILURE_POINT) : -1
  for (const [index, piece] of pieces.entries()) {
    if (signal.aborted) return false
    if (index === failureIndex) {
      send(STREAM_EVENT.error, { code: ERROR_CODE.internal, message: MODEL_FAILURE_MESSAGE })
      return false
    }
    send(STREAM_EVENT.token, { text: piece })
    await wait(FIXTURE_DELAY_MS.token)
  }
  return true
}

function countTokens(text: string): number {
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN)
}

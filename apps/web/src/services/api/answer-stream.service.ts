import {
  doneEventSchema,
  errorEventSchema,
  PRESET,
  retrievalEventSchema,
  STREAM_EVENT,
  tokenEventSchema,
  type DoneEvent,
  type ErrorEvent,
  type RetrievalEvent,
  type TokenEvent,
} from 'repotron-domain'

import { getHttpClient } from './client'
import { INDEX_PATH } from './endpoints'

export type QuestionBody =
  | { question: string }
  | { preset: typeof PRESET.startHere }
  | { preset: typeof PRESET.explainFeature; featureName: string }

export type AnswerStreamEvent =
  | { name: typeof STREAM_EVENT.retrieval; data: RetrievalEvent }
  | { name: typeof STREAM_EVENT.token; data: TokenEvent }
  | { name: typeof STREAM_EVENT.done; data: DoneEvent }
  | { name: typeof STREAM_EVENT.error; data: ErrorEvent }

const BLOCK_SEPARATOR = '\n\n'
const EVENT_FIELD = 'event:'
const DATA_FIELD = 'data:'

/** Asks a question about an index and yields each event of the answer in order. */
export async function* openAnswerStream(
  indexId: string,
  body: QuestionBody,
  signal: AbortSignal,
): AsyncGenerator<AnswerStreamEvent> {
  const stream = await getHttpClient().postStream(INDEX_PATH.questions(indexId), body, signal)
  yield* readEvents(stream)
}

/** Splits the stream at each blank line. A network chunk can end in the middle of a block, so the rest waits in a buffer. */
export async function* readEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<AnswerStreamEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const next = await reader.read()
    if (next.done) return
    buffer += decoder.decode(next.value, { stream: true })
    const blocks = buffer.split(BLOCK_SEPARATOR)
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      if (block.trim() !== '') yield parseEventBlock(block)
    }
  }
}

/** Reads the event name and the data lines of one block, then checks the data with the schema of that event. */
export function parseEventBlock(block: string): AnswerStreamEvent {
  const lines = block.split('\n')
  const nameLine = lines.find((line) => line.startsWith(EVENT_FIELD))
  const name = nameLine?.slice(EVENT_FIELD.length).trim()
  const dataLines = lines.filter((line) => line.startsWith(DATA_FIELD))
  const data: unknown = JSON.parse(dataLines.map((line) => line.slice(DATA_FIELD.length).trimStart()).join('\n'))
  switch (name) {
    case STREAM_EVENT.retrieval:
      return { name, data: retrievalEventSchema.parse(data) }
    case STREAM_EVENT.token:
      return { name, data: tokenEventSchema.parse(data) }
    case STREAM_EVENT.done:
      return { name, data: doneEventSchema.parse(data) }
    case STREAM_EVENT.error:
      return { name, data: errorEventSchema.parse(data) }
    default:
      throw new Error(`The answer stream sent an unknown event: ${name}`)
  }
}

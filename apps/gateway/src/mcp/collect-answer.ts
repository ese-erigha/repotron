import { citationSchema, ERROR_CODE, STREAM_EVENT, type Citation } from 'repotron-domain'

import { RequestError } from '../http-error.ts'

export type CollectedAnswer = {
  questionId: string
  answer: string
  citations: Citation[]
}

/** Reads the answer stream into one result. An error event fails the call. */
export function collectAnswer(body: string): CollectedAnswer {
  let answer = ''
  let citations: Citation[] = []
  let questionId = ''
  let failure = ''
  for (const block of body.split('\n\n')) {
    const event = readEvent(block)
    if (!event) continue
    if (event.name === STREAM_EVENT.token) answer += textOf(event.data)
    if (event.name === STREAM_EVENT.retrieval) citations = citationsOf(event.data)
    if (event.name === STREAM_EVENT.done) questionId = idOf(event.data)
    if (event.name === STREAM_EVENT.error) failure = messageOf(event.data)
  }
  if (failure !== '') throw new RequestError(500, ERROR_CODE.internal, failure)
  if (questionId === '') throw new RequestError(500, ERROR_CODE.internal, 'The answer failed.')
  return { questionId, answer, citations }
}

function readEvent(block: string): { name: string; data: unknown } | undefined {
  const name = block.match(/^event: (.+)$/m)?.[1]
  const raw = block.match(/^data: (.+)$/m)?.[1]
  if (!name || !raw) return undefined
  return { name, data: JSON.parse(raw) as unknown }
}

function textOf(data: unknown): string {
  if (!isRecord(data) || typeof data.text !== 'string') return ''
  return data.text
}

function idOf(data: unknown): string {
  if (!isRecord(data) || typeof data.questionId !== 'string') return ''
  return data.questionId
}

function messageOf(data: unknown): string {
  if (!isRecord(data) || typeof data.message !== 'string') return 'The answer failed.'
  return data.message
}

function citationsOf(data: unknown): Citation[] {
  if (!isRecord(data)) return []
  return citationSchema.array().parse(data.citations)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

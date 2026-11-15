import {
  doneEventSchema,
  errorCodeSchema,
  errorEventSchema,
  indexViewSchema,
  questionViewSchema,
  retrievalEventSchema,
  STREAM_EVENT,
  tokenEventSchema,
  type IndexView,
  type QuestionView,
  type StreamEventName,
} from 'repotron-domain'

import { FixtureRequestError } from './fixture-store.ts'
import { FIXTURE_ERROR, type FixtureError } from './scenarios.ts'

const JSON_HEADERS = { 'content-type': 'application/json' }

function jsonResponse(status: number, body: unknown, headers?: Headers): Response {
  return new Response(JSON.stringify(body), { status, headers: headers ?? JSON_HEADERS })
}

/** One index. The schema is the body of `POST /indexes` and `GET /indexes/:id`. */
export function indexResponse(status: number, index: IndexView): Response {
  return jsonResponse(status, indexViewSchema.parse(index))
}

/** The list. The schema is the body of `GET /indexes`. */
export function indexesResponse(indexes: IndexView[]): Response {
  const views = indexes.map((index) => indexViewSchema.parse(index))
  return jsonResponse(200, { indexes: views })
}

/** One stored answer. The schema is the body of `GET /questions/:id`. */
export function questionResponse(question: QuestionView): Response {
  return jsonResponse(200, questionViewSchema.parse(question))
}

/** The error envelope of the gateway: `{ error: { code, message } }`. */
export function errorResponse(error: FixtureError): Response {
  const headers = new Headers(JSON_HEADERS)
  if (error.retryAfterSeconds !== undefined) headers.set('Retry-After', String(error.retryAfterSeconds))
  const code = errorCodeSchema.parse(error.code)
  return jsonResponse(error.status, { error: { code, message: error.message } }, headers)
}

export function failureResponse(failure: unknown): Response {
  const error = failure instanceof FixtureRequestError ? failure.detail : FIXTURE_ERROR.internal
  return errorResponse(error)
}

/** One stream event. The schema is the data line the gateway sends for that event. */
export function eventBytes(name: StreamEventName, data: unknown): Uint8Array {
  const body = eventData(name, data)
  return new TextEncoder().encode(`event: ${name}\ndata: ${JSON.stringify(body)}\n\n`)
}

function eventData(name: StreamEventName, data: unknown): unknown {
  switch (name) {
    case STREAM_EVENT.retrieval:
      return retrievalEventSchema.parse(data)
    case STREAM_EVENT.token:
      return tokenEventSchema.parse(data)
    case STREAM_EVENT.done:
      return doneEventSchema.parse(data)
    case STREAM_EVENT.error:
      return errorEventSchema.parse(data)
  }
}

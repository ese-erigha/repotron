import { setTimeout as wait } from 'node:timers/promises'

import {
  FEATURE_NAME_MAX_CHARS,
  INDEX_STATUS,
  parseRepositoryLink,
  PRESET,
  QUESTION_MAX_CHARS,
} from 'repotron-domain'

import { scriptAnswer, type QuestionBody } from './answer-script.ts'
import { streamAnswer, type AnswerStreamInput } from './answer-stream.ts'
import { FixtureDisconnect, FixtureRequestError, type FixtureStore } from './fixture-store.ts'
import { FIXTURE_DELAY_MS, FIXTURE_ERROR, QUESTION_SCENARIO } from './scenarios.ts'
import { failureResponse, indexResponse, indexesResponse, questionResponse, symbolTraceResponse } from './send-response.ts'

/** The routes of the gateway under `/api/v1`. The caller strips that prefix. */
const ROUTE = {
  listRecentIndexes: 'GET /indexes',
  requestIndex: 'POST /indexes',
  readIndex: 'GET /indexes/:id',
  traceSymbol: 'GET /indexes/:id/symbols/:name',
  askQuestion: 'POST /indexes/:id/questions',
  readQuestion: 'GET /questions/:id',
} as const

const ID_SEGMENT = ':id'

type MatchedRoute = { name: string; id: string; symbol: string }

/** Answers one API request from the fixture store. The body matches the gateway schema. */
export async function answerRequest(store: FixtureStore, request: Request): Promise<Response> {
  try {
    return await routeRequest(store, request)
  } catch (failure) {
    if (failure instanceof FixtureDisconnect) throw failure
    return failureResponse(failure)
  }
}

async function routeRequest(store: FixtureStore, request: Request): Promise<Response> {
  const route = matchRoute(request)
  switch (route.name) {
    case ROUTE.listRecentIndexes:
      return listRecentIndexes(store)
    case ROUTE.requestIndex:
      return requestIndex(store, request)
    case ROUTE.readIndex:
      return readIndex(store, route.id)
    case ROUTE.traceSymbol:
      return traceSymbol(store, route.id, route.symbol)
    case ROUTE.askQuestion:
      return askQuestion(store, route.id, request)
    case ROUTE.readQuestion:
      return readQuestion(store, route.id)
    default:
      throw new FixtureRequestError(FIXTURE_ERROR.missingRoute)
  }
}

/** Names the route of a request. The second path segment is the id. */
function matchRoute(request: Request): MatchedRoute {
  const path = new URL(request.url).pathname
  const [resource = '', id = '', action = '', symbol = ''] = path.split('/').filter((segment) => segment !== '')
  if (resource === 'indexes' && action === 'symbols') {
    return { name: ROUTE.traceSymbol, id, symbol }
  }
  const rest = action === '' ? [] : [action, ...(symbol === '' ? [] : [symbol])]
  const segments = id === '' ? [resource] : [resource, ID_SEGMENT, ...rest]
  return { name: `${request.method} /${segments.join('/')}`, id, symbol: '' }
}

async function listRecentIndexes(store: FixtureStore): Promise<Response> {
  await wait(FIXTURE_DELAY_MS.read)
  return indexesResponse(store.listRecentIndexes(Date.now()))
}

async function requestIndex(store: FixtureStore, request: Request): Promise<Response> {
  const body = await readJsonBody(request)
  await wait(FIXTURE_DELAY_MS.requestIndex)
  if (!isRecord(body) || typeof body.url !== 'string' || !isFilled(body.turnstileToken)) {
    throw new FixtureRequestError(FIXTURE_ERROR.invalidRequest)
  }
  const link = parseRepositoryLink(body.url)
  if (!link) throw new FixtureRequestError(FIXTURE_ERROR.invalidLink)
  const result = store.requestIndex(link, Date.now())
  return indexResponse(result.status, result.index)
}

async function readIndex(store: FixtureStore, indexId: string): Promise<Response> {
  await wait(FIXTURE_DELAY_MS.read)
  const index = store.getIndex(indexId)
  if (!index) throw new FixtureRequestError(FIXTURE_ERROR.missingIndex)
  return indexResponse(200, store.viewOf(index, Date.now()))
}

async function traceSymbol(store: FixtureStore, indexId: string, name: string): Promise<Response> {
  await wait(FIXTURE_DELAY_MS.read)
  if (name.trim() === '') throw new FixtureRequestError(FIXTURE_ERROR.invalidRequest)
  return symbolTraceResponse(store.traceSymbol(indexId, name, Date.now()))
}

async function readQuestion(store: FixtureStore, questionId: string): Promise<Response> {
  await wait(FIXTURE_DELAY_MS.read)
  const question = store.getQuestion(questionId)
  if (!question) throw new FixtureRequestError(FIXTURE_ERROR.missingAnswer)
  return questionResponse(question)
}

async function askQuestion(store: FixtureStore, indexId: string, request: Request): Promise<Response> {
  const body = readQuestionBody(await readJsonBody(request))
  if (!body) throw new FixtureRequestError(FIXTURE_ERROR.invalidRequest)
  const question = 'question' in body ? body.question : ''
  if (question === QUESTION_SCENARIO.limit) throw new FixtureRequestError(FIXTURE_ERROR.rateLimited)
  if (question === QUESTION_SCENARIO.offline) throw new FixtureDisconnect()
  const index = store.getIndex(indexId)
  if (!index) throw new FixtureRequestError(FIXTURE_ERROR.missingIndex)
  if (store.viewOf(index, Date.now()).status !== INDEX_STATUS.ready) {
    throw new FixtureRequestError(FIXTURE_ERROR.indexNotReady)
  }
  const input: AnswerStreamInput = {
    index,
    answer: scriptAnswer(index.repository, body),
    isSlow: question === QUESTION_SCENARIO.slow,
    failsMidway: question === QUESTION_SCENARIO.error,
  }
  return streamAnswer(store, input, request.signal)
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch (cause) {
    throw new FixtureRequestError(FIXTURE_ERROR.invalidRequest, { cause })
  }
}

/** Accepts the 3 body shapes of the gateway: a question, the start preset, or the feature preset. */
function readQuestionBody(value: unknown): QuestionBody | undefined {
  if (!isRecord(value)) return undefined
  if (value.preset === PRESET.startHere) return { preset: PRESET.startHere }
  if (value.preset === PRESET.explainFeature) {
    const featureName = readText(value.featureName, FEATURE_NAME_MAX_CHARS)
    return featureName === undefined ? undefined : { preset: PRESET.explainFeature, featureName }
  }
  const question = readText(value.question, QUESTION_MAX_CHARS)
  return question === undefined ? undefined : { question }
}

function readText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text.length >= 1 && text.length <= maxLength ? text : undefined
}

function isFilled(value: unknown): boolean {
  return typeof value === 'string' && value !== ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

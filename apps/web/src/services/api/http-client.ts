import { ERROR_CODE, errorCodeSchema, type ErrorCode } from 'repotron-domain'

/** The code of a request that got no response. The gateway never sends this code. */
export const NETWORK_ERROR_CODE = 'network'

export type ApiErrorCode = ErrorCode | typeof NETWORK_ERROR_CODE

export type ApiErrorDetail = {
  code: ApiErrorCode
  message: string
  status: number
  retryAfterSeconds?: number
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly retryAfterSeconds: number | undefined

  constructor(detail: ApiErrorDetail, options?: ErrorOptions) {
    super(detail.message, options)
    this.name = 'ApiError'
    this.code = detail.code
    this.status = detail.status
    this.retryAfterSeconds = detail.retryAfterSeconds
  }
}

const HTTP_METHOD = { GET: 'GET', POST: 'POST' } as const

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const STREAM_HEADERS = { ...JSON_HEADERS, Accept: 'text/event-stream' } as const

const TOO_MANY_REQUESTS = 429

const MISSING_STREAM: ApiErrorDetail = {
  code: ERROR_CODE.internal,
  message: 'The server sent no answer stream.',
  status: 0,
}

/** The one client of the app. Every request passes through `request`. */
export class HttpClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.request(path, { method: HTTP_METHOD.GET })
    return (await response.json()) as T
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const init: RequestInit = { method: HTTP_METHOD.POST, headers: JSON_HEADERS, body: JSON.stringify(body) }
    const response = await this.request(path, init)
    return (await response.json()) as T
  }

  async postStream(path: string, body: unknown, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const init: RequestInit = {
      method: HTTP_METHOD.POST,
      headers: STREAM_HEADERS,
      body: JSON.stringify(body),
      signal,
    }
    const response = await this.request(path, init)
    if (!response.body) throw new ApiError(MISSING_STREAM)
    return response.body
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await send(this.baseUrl + path, init)
    if (!response.ok) throw await toApiError(response)
    return response
  }
}

/** Reads the error envelope of the gateway: `{ error: { code, message } }`. */
async function toApiError(response: Response): Promise<ApiError> {
  const envelope = await readEnvelope(response)
  const detail: ApiErrorDetail = {
    code: envelope?.code ?? ERROR_CODE.internal,
    message: envelope?.message ?? fallbackMessage(response),
    status: response.status,
    retryAfterSeconds: readRetryAfter(response),
  }
  return new ApiError(detail)
}

/** Gives every failure the shape of an ApiError, so a component reads one type. */
export function asApiError(failure: unknown): ApiError {
  if (failure instanceof ApiError) return failure
  return new ApiError(networkFailure(), { cause: failure })
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (cause) {
    // The caller aborted the request, so the UI shows nothing.
    if (isAbortError(cause)) throw cause
    throw new ApiError(networkFailure(), { cause })
  }
}

function networkFailure(): ApiErrorDetail {
  return { code: NETWORK_ERROR_CODE, message: 'The server did not respond.', status: 0 }
}

function isAbortError(failure: unknown): boolean {
  return failure instanceof Error && failure.name === 'AbortError'
}

async function readEnvelope(response: Response): Promise<{ code: ErrorCode; message: string } | undefined> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // An HTML error page has no envelope. The caller uses the status text.
    return undefined
  }
  const error = isRecord(body) ? body.error : undefined
  if (!isRecord(error) || typeof error.message !== 'string') return undefined
  const code = errorCodeSchema.safeParse(error.code)
  return code.success ? { code: code.data, message: error.message } : undefined
}

function fallbackMessage(response: Response): string {
  return response.statusText === '' ? 'Something went wrong.' : response.statusText
}

function readRetryAfter(response: Response): number | undefined {
  if (response.status !== TOO_MANY_REQUESTS) return undefined
  const seconds = Number(response.headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

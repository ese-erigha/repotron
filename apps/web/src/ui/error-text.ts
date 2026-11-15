import { ERROR_CODE } from 'repotron-domain'

import { NETWORK_ERROR_CODE, type ApiErrorCode } from '../services/api/http-client'

/** The parts of an error that the UI shows. An `ApiError` and a stream error event both fit. */
export type ErrorDetail = {
  code: ApiErrorCode
  message: string
  retryAfterSeconds?: number
}

export const ERROR_TEXT = {
  NETWORK: 'Repotron could not reach the server. Check the connection and try again.',
} as const

const SECONDS_PER_MINUTE = 60

/** The gateway owns the wording of each message. The UI adds the wait time and the network text. */
export function readErrorText(error: ErrorDetail): string {
  if (error.code === NETWORK_ERROR_CODE) return ERROR_TEXT.NETWORK
  if (error.code !== ERROR_CODE.rateLimited || error.retryAfterSeconds === undefined) return error.message
  const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE))
  const unit = minutes === 1 ? 'minute' : 'minutes'
  return `${error.message} Try again in ${minutes} ${unit}.`
}

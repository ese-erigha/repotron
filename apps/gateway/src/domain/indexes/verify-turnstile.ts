import { ERROR_CODE } from 'repotron-domain'

import { getConfig } from '../../context.ts'
import { RequestError } from '../../http-error.ts'

export async function verifyTurnstile(token: string, remoteIp: string): Promise<void> {
  const body = new URLSearchParams({
    secret: getConfig().TURNSTILE_SECRET,
    response: token,
    remoteip: remoteIp,
  })
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw failed()
  const result: unknown = await response.json()
  if (!isRecord(result) || result.success !== true) throw failed()
}

function failed(): RequestError {
  return new RequestError(403, ERROR_CODE.turnstileFailed, 'The Turnstile check failed.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

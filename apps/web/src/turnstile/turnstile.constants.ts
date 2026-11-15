export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const TURNSTILE_STATE = {
  CHECKING: 'checking',
  VERIFIED: 'verified',
  FAILED: 'failed',
} as const

export type TurnstileState = (typeof TURNSTILE_STATE)[keyof typeof TURNSTILE_STATE]

export const TURNSTILE_TEXT: Record<TurnstileState, string> = {
  [TURNSTILE_STATE.CHECKING]: 'Checking your browser',
  [TURNSTILE_STATE.VERIFIED]: 'Browser check passed',
  [TURNSTILE_STATE.FAILED]: 'The browser check did not load. Reload the page.',
}

/** The widget stays hidden unless Cloudflare needs the user to act. */
export const TURNSTILE_APPEARANCE = 'interaction-only'

export const TURNSTILE_THEME = 'light'

export const TURNSTILE_SIZE = 'flexible'

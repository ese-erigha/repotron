import { TURNSTILE_SCRIPT_URL } from './turnstile.constants'

export type TurnstileOptions = {
  sitekey: string
  appearance: string
  theme: string
  size: string
  callback(token: string): void
  'expired-callback'(): void
  'error-callback'(): void
}

/** The part of the Turnstile API that the widget uses. */
export type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileOptions): string
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** Adds the Turnstile script to the page one time, for the whole app. */
export function loadTurnstileScript(): HTMLScriptElement {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
  if (existing) return existing
  const script = document.createElement('script')
  script.src = TURNSTILE_SCRIPT_URL
  script.async = true
  document.head.append(script)
  return script
}

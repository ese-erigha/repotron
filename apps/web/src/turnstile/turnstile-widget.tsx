import { useEffect, useRef, useState } from 'react'

import { TURNSTILE_SITE_KEY } from '../config/public-config'
import { cn } from '../ui/cn'
import { loadTurnstileScript } from './load-turnstile'
import { TurnstileStateIcon } from './turnstile-state-icon'
import {
  TURNSTILE_APPEARANCE,
  TURNSTILE_SIZE,
  TURNSTILE_STATE,
  TURNSTILE_TEXT,
  TURNSTILE_THEME,
  type TurnstileState,
} from './turnstile.constants'

type TurnstileWidgetProps = {
  /** Receives the token, or null when the token expires or the check fails. */
  onToken(token: string | null): void
  /** A token works once. The parent changes this value after each request to get a new token. */
  resetKey: number
  className?: string
}

export function TurnstileWidget({ onToken, resetKey, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const [state, setState] = useState<TurnstileState>(TURNSTILE_STATE.CHECKING)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const script = loadTurnstileScript()

    function updateToken(token: string | null, next: TurnstileState) {
      setState(next)
      onTokenRef.current(token)
    }

    function renderWidget() {
      if (!window.turnstile || !container || widgetIdRef.current !== null) return
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: TURNSTILE_APPEARANCE,
        theme: TURNSTILE_THEME,
        size: TURNSTILE_SIZE,
        callback: (token) => updateToken(token, TURNSTILE_STATE.VERIFIED),
        'expired-callback': () => updateToken(null, TURNSTILE_STATE.CHECKING),
        'error-callback': () => updateToken(null, TURNSTILE_STATE.FAILED),
      })
    }

    function reportLoadFailure() {
      // The next widget adds a new script, so a later screen can try again.
      script.remove()
      updateToken(null, TURNSTILE_STATE.FAILED)
    }

    renderWidget()
    script.addEventListener('load', renderWidget)
    script.addEventListener('error', reportLoadFailure)
    return () => {
      script.removeEventListener('load', renderWidget)
      script.removeEventListener('error', reportLoadFailure)
      if (widgetIdRef.current !== null) window.turnstile?.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (resetKey === 0 || widgetIdRef.current === null) return
    setState(TURNSTILE_STATE.CHECKING)
    onTokenRef.current(null)
    window.turnstile?.reset(widgetIdRef.current)
  }, [resetKey])

  return (
    <div className={className}>
      <p
        aria-live="polite"
        className={cn(
          'flex items-center gap-1.5 text-[13px]',
          state === TURNSTILE_STATE.FAILED ? 'text-danger' : 'text-mute',
        )}
      >
        <TurnstileStateIcon state={state} />
        {TURNSTILE_TEXT[state]}
      </p>
      <div ref={containerRef} className="mt-2 empty:hidden" />
    </div>
  )
}

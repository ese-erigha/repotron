import { ArrowRight, ScanSearch } from 'lucide-react'
import { useState } from 'react'

import { TurnstileWidget } from '../turnstile/turnstile-widget'
import { Button } from '../ui/button'
import { ErrorMessage } from '../ui/error-message'
import { readErrorText, type ErrorDetail } from '../ui/error-text'
import { SurfaceCard } from '../ui/surface-card'
import { SURFACE_ELEVATION } from '../ui/surface-card.constants'
import { INTAKE_TEXT } from './intake.constants'

type StartIndexCardProps = {
  isPending: boolean
  error: ErrorDetail | null
  turnstileResetKey: number
  onSubmit(turnstileToken: string): void
}

/** The card of a repository with no index in the URL. It starts the index job. */
export function StartIndexCard({ isPending, error, turnstileResetKey, onSubmit }: StartIndexCardProps) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  function startIndex() {
    if (turnstileToken !== null) onSubmit(turnstileToken)
  }

  return (
    <SurfaceCard elevation={SURFACE_ELEVATION.RAISED} className="animate-rise p-6 sm:p-8">
      <div className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
        <ScanSearch aria-hidden className="size-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">{INTAKE_TEXT.START_TITLE}</h2>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-mute">{INTAKE_TEXT.START_DESCRIPTION}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
        <Button isPending={isPending} disabled={turnstileToken === null} onClick={startIndex}>
          {INTAKE_TEXT.START_SUBMIT}
          {isPending ? null : <ArrowRight aria-hidden className="size-4" />}
        </Button>
      </div>
      {error ? <ErrorMessage message={readErrorText(error)} className="mt-4" /> : null}
    </SurfaceCard>
  )
}

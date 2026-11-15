import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { IndexView } from 'repotron-domain'

import { TurnstileWidget } from '../turnstile/turnstile-widget'
import { Button } from '../ui/button'
import { ErrorMessage } from '../ui/error-message'
import { readErrorText, type ErrorDetail } from '../ui/error-text'
import { SurfaceCard } from '../ui/surface-card'
import { SURFACE_ELEVATION } from '../ui/surface-card.constants'
import { failedTitle, INDEX_STATUS_TEXT } from './index-status.constants'
import { STAGE_ORDER } from './index-stage'

type IndexFailureCardProps = {
  index: IndexView
  isPending: boolean
  /** The error of the retry request, not the reason of the index failure. */
  error: ErrorDetail | null
  turnstileResetKey: number
  onRetry(turnstileToken: string): void
}

/** States the stage and the reason of a failed index job, and starts the job again. */
export function IndexFailureCard({ index, isPending, error, turnstileResetKey, onRetry }: IndexFailureCardProps) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const failedStage = STAGE_ORDER.find((stage) => stage === index.failedStage)

  function retryIndex() {
    if (turnstileToken !== null) onRetry(turnstileToken)
  }

  return (
    <SurfaceCard elevation={SURFACE_ELEVATION.RAISED} className="animate-rise p-6 sm:p-8">
      <div className="grid size-11 place-items-center rounded-xl bg-danger-soft text-danger">
        <TriangleAlert aria-hidden className="size-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        {failedStage ? failedTitle(failedStage) : INDEX_STATUS_TEXT.FAILED_FALLBACK_TITLE}
      </h2>
      {index.failureReason ? (
        <p className="mt-3 rounded-xl border border-line bg-sunken px-4 py-3 text-[15px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">{INDEX_STATUS_TEXT.FAILED_REASON}: </span>
          {index.failureReason}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
        <Button isPending={isPending} disabled={turnstileToken === null} onClick={retryIndex}>
          {isPending ? null : <RefreshCw aria-hidden className="size-4" />}
          {INDEX_STATUS_TEXT.RETRY}
        </Button>
      </div>
      {error ? <ErrorMessage message={readErrorText(error)} className="mt-4" /> : null}
    </SurfaceCard>
  )
}

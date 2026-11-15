import { RefreshCw } from 'lucide-react'

import { Button } from '../ui/button'
import { BUTTON_SIZE, BUTTON_VARIANT } from '../ui/button.constants'
import { ErrorMessage } from '../ui/error-message'
import { readErrorText } from '../ui/error-text'
import { Skeleton } from '../ui/skeleton'
import { SurfaceCard } from '../ui/surface-card'
import { AnswerStatus } from './answer-status'
import { ANSWER_PHASE, type AnswerStreamState } from './answer-stream-state'
import { AnswerView } from './answer-view'
import { ANSWER_SKELETON_WIDTHS, ASK_TEXT } from './ask.constants'
import { ShareButton } from './share-button'

type AnswerCardProps = {
  answer: AnswerStreamState
  onSelectCitation(number: number): void
  /** Asks the same question again after a failure. */
  onRetry(): void
}

/** The question and its answer, from the first wait to the Share button. */
export function AnswerCard({ answer, onSelectCitation, onRetry }: AnswerCardProps) {
  const isLoading = answer.phase === ANSWER_PHASE.WAITING || answer.phase === ANSWER_PHASE.RETRIEVED
  const isStreaming = answer.phase === ANSWER_PHASE.STREAMING
  const sourceNumbers = answer.citations.map((citation) => citation.number)

  return (
    <section className="animate-rise">
      <h2 className="px-1 text-2xl leading-snug font-semibold tracking-[-0.02em] text-balance text-ink">
        {answer.question}
      </h2>
      <SurfaceCard className="mt-5 p-5 sm:p-7">
        <AnswerStatus phase={answer.phase} answerMs={answer.answerMs} />
        <div aria-live="polite" aria-busy={isLoading || isStreaming} className="mt-5">
          {isLoading ? (
            <div aria-hidden className="space-y-3 py-1">
              {ANSWER_SKELETON_WIDTHS.map((width) => (
                <Skeleton key={width} className={`h-4 ${width}`} />
              ))}
            </div>
          ) : null}
          {answer.text === '' ? null : (
            <AnswerView
              text={answer.text}
              sourceNumbers={sourceNumbers}
              isStreaming={isStreaming}
              onSelectCitation={onSelectCitation}
            />
          )}
        </div>
        {answer.error ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <ErrorMessage message={readErrorText(answer.error)} />
            <Button variant={BUTTON_VARIANT.SECONDARY} size={BUTTON_SIZE.SM} onClick={onRetry}>
              <RefreshCw aria-hidden className="size-3.5" />
              {ASK_TEXT.RETRY}
            </Button>
          </div>
        ) : null}
        {answer.questionId === null ? null : (
          <footer className="mt-6 border-t border-line pt-4">
            <ShareButton questionId={answer.questionId} />
          </footer>
        )}
      </SurfaceCard>
    </section>
  )
}

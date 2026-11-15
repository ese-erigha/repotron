import { Check, Sparkles } from 'lucide-react'

import { formatSeconds } from '../ui/format'
import { Spinner } from '../ui/spinner'
import { ANSWER_PHASE, type AnswerPhase } from './answer-stream-state'
import { ASK_TEXT } from './ask.constants'

type AnswerStatusProps = {
  phase: AnswerPhase
  answerMs: number | null
}

const PROGRESS_TEXT: Partial<Record<AnswerPhase, string>> = {
  [ANSWER_PHASE.WAITING]: ASK_TEXT.SEARCHING,
  [ANSWER_PHASE.RETRIEVED]: ASK_TEXT.READING,
  [ANSWER_PHASE.STREAMING]: ASK_TEXT.WRITING,
}

/** The title row of the answer, with the step that runs now. */
export function AnswerStatus({ phase, answerMs }: AnswerStatusProps) {
  const progressText = PROGRESS_TEXT[phase]

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-mute uppercase">
        <Sparkles aria-hidden className="size-4 text-accent" />
        {ASK_TEXT.ANSWER_TITLE}
      </p>
      {progressText ? (
        <p className="flex items-center gap-1.5 text-[13px] text-mute">
          <Spinner className="size-3.5 text-accent" />
          {progressText}
        </p>
      ) : null}
      {phase === ANSWER_PHASE.DONE && answerMs !== null ? (
        <p className="flex items-center gap-1.5 text-[13px] text-mute">
          <Check aria-hidden className="size-3.5 text-success" />
          {ASK_TEXT.ANSWERED_IN} {formatSeconds(answerMs)}
        </p>
      ) : null}
    </div>
  )
}

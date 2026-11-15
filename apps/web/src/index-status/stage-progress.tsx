import { Check } from 'lucide-react'
import type { IndexStatus } from 'repotron-domain'

import { cn } from '../ui/cn'
import { STAGE_LABEL } from './index-status.constants'
import { STAGE_ORDER, STAGE_STATE, stageStateOf, type StageState } from './index-stage'

type StageProgressProps = {
  status: IndexStatus
  className?: string
}

const NODE_CLASS: Record<StageState, string> = {
  [STAGE_STATE.DONE]: 'border-accent bg-accent text-white',
  [STAGE_STATE.CURRENT]: 'animate-ring border-accent bg-surface',
  [STAGE_STATE.UPCOMING]: 'border-line-strong bg-surface',
}

/** The line from a stage to the next one. */
const CONNECTOR_CLASS: Record<StageState, string> = {
  [STAGE_STATE.DONE]: 'bg-accent',
  [STAGE_STATE.CURRENT]: 'stage-flow',
  [STAGE_STATE.UPCOMING]: 'bg-line',
}

const LABEL_CLASS: Record<StageState, string> = {
  [STAGE_STATE.DONE]: 'text-ink-soft',
  [STAGE_STATE.CURRENT]: 'font-semibold text-ink',
  [STAGE_STATE.UPCOMING]: 'text-faint',
}

/** The stages of the index job in one row. Each stage up to the current status is filled. */
export function StageProgress({ status, className }: StageProgressProps) {
  return (
    <ol className={cn('grid grid-cols-4', className)}>
      {STAGE_ORDER.map((stage, position) => {
        const state = stageStateOf(stage, status)
        const isLast = position === STAGE_ORDER.length - 1
        return (
          <li
            key={stage}
            aria-current={state === STAGE_STATE.CURRENT ? 'step' : undefined}
            className="relative flex flex-col items-center gap-2.5"
          >
            {isLast ? null : (
              <span
                aria-hidden
                className={cn('absolute top-[13px] left-1/2 h-0.5 w-full', CONNECTOR_CLASS[state])}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative grid size-7 place-items-center rounded-full border-2 transition-colors duration-500',
                NODE_CLASS[state],
              )}
            >
              {state === STAGE_STATE.DONE ? <Check className="size-3.5" strokeWidth={3} /> : null}
              {state === STAGE_STATE.CURRENT ? <span className="size-2 rounded-full bg-accent" /> : null}
            </span>
            <span className={cn('text-[13px] transition-colors duration-500', LABEL_CLASS[state])}>
              {STAGE_LABEL[stage]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

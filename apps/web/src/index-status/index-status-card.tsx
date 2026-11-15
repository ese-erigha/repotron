import type { IndexView } from 'repotron-domain'

import { formatCount } from '../ui/format'
import { Spinner } from '../ui/spinner'
import { SurfaceCard } from '../ui/surface-card'
import { SURFACE_ELEVATION } from '../ui/surface-card.constants'
import { INDEX_STATUS_TEXT, STAGE_DESCRIPTION } from './index-status.constants'
import { STAGE_ORDER, type IndexStage } from './index-stage'
import { StageProgress } from './stage-progress'

type IndexStatusCardProps = { index: IndexView }

/** The progress of an index job: the stage, its description, and the counts. */
export function IndexStatusCard({ index }: IndexStatusCardProps) {
  const stage: IndexStage = STAGE_ORDER.find((entry) => entry === index.status) ?? STAGE_ORDER[0]
  const counts = [
    { label: INDEX_STATUS_TEXT.FILES, value: index.fileCount },
    { label: INDEX_STATUS_TEXT.CHUNKS, value: index.chunkCount },
  ]

  return (
    <SurfaceCard elevation={SURFACE_ELEVATION.RAISED} className="animate-rise p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Spinner className="size-5" />
        </div>
        <div aria-live="polite">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{INDEX_STATUS_TEXT.INDEXING_TITLE}</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-mute">{STAGE_DESCRIPTION[stage]}</p>
        </div>
      </div>
      <StageProgress status={index.status} className="mt-9" />
      <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {counts.map((count) => (
          <div key={count.label} className="bg-surface px-4 py-3.5">
            <dt className="text-[13px] text-mute">{count.label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tracking-tight text-ink tabular-nums">
              {count.value === null ? INDEX_STATUS_TEXT.PENDING_COUNT : formatCount(count.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-[13px] text-mute">{INDEX_STATUS_TEXT.POLL_NOTE}</p>
    </SurfaceCard>
  )
}

import { RefreshCw } from 'lucide-react'
import type { IndexStatus } from 'repotron-domain'

import { INDEX_STATUS_TEXT, STAGE_LABEL } from './index-status.constants'
import { STAGE_ORDER } from './index-stage'

type ReindexBannerProps = {
  /** The status of the newer index. */
  status: IndexStatus
}

/** States that a newer commit indexes while an earlier index answers the questions. */
export function ReindexBanner({ status }: ReindexBannerProps) {
  const stage = STAGE_ORDER.find((entry) => entry === status)

  return (
    <div
      role="status"
      className="flex animate-rise flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-accent-line bg-accent-soft px-4 py-3 text-sm text-ink-soft"
    >
      <RefreshCw aria-hidden className="size-4 shrink-0 animate-spin text-accent [animation-duration:2.4s]" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold text-ink">{INDEX_STATUS_TEXT.REINDEX_TITLE}</span>{' '}
        {INDEX_STATUS_TEXT.REINDEX_TEXT}
      </p>
      {stage ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-accent-strong shadow-card">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-accent" />
          {STAGE_LABEL[stage]}
        </span>
      ) : null}
    </div>
  )
}

import { useState } from 'react'
import { INDEX_STATUS, type IndexView } from 'repotron-domain'

import { cn } from '../ui/cn'
import { formatRelativeTime } from '../ui/format'
import { INDEX_STATUS_TEXT } from './index-status.constants'

type IndexStatusPillProps = { index: IndexView }

type PillStyle = { pill: string; dot: string }

const READY_STYLE: PillStyle = { pill: 'bg-success-soft text-success', dot: 'bg-success' }
const FAILED_STYLE: PillStyle = { pill: 'bg-danger-soft text-danger', dot: 'bg-danger' }
const INDEXING_STYLE: PillStyle = { pill: 'bg-accent-soft text-accent-strong', dot: 'animate-pulse bg-accent' }

/** One short label for the state of an index: indexed, indexing, or failed. */
export function IndexStatusPill({ index }: IndexStatusPillProps) {
  const [now] = useState(() => Date.now())
  const style = pillStyleOf(index)

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', style.pill)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', style.dot)} />
      {pillLabelOf(index, now)}
    </span>
  )
}

function pillStyleOf(index: IndexView): PillStyle {
  if (index.status === INDEX_STATUS.ready) return READY_STYLE
  return index.status === INDEX_STATUS.failed ? FAILED_STYLE : INDEXING_STYLE
}

function pillLabelOf(index: IndexView, now: number): string {
  if (index.status === INDEX_STATUS.failed) return INDEX_STATUS_TEXT.FAILED_PILL
  if (index.status !== INDEX_STATUS.ready) return INDEX_STATUS_TEXT.INDEXING_PILL
  return `${INDEX_STATUS_TEXT.INDEXED} ${formatRelativeTime(index.readyAt ?? index.createdAt, now)}`
}

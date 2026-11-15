import { useState } from 'react'
import type { IndexView } from 'repotron-domain'

import { Skeleton } from '../ui/skeleton'
import { INTAKE_TEXT, RECENT_SKELETON_COUNT } from './intake.constants'
import { RecentIndexRow } from './recent-index-row'

type RecentIndexListProps = {
  indexes: IndexView[]
  isLoading: boolean
  hasFailed: boolean
}

export function RecentIndexList({ indexes, isLoading, hasFailed }: RecentIndexListProps) {
  // One time for the whole list, read when the list opens, so each row counts its age from the same moment.
  const [now] = useState(() => Date.now())

  return (
    <section aria-labelledby="recent-title" className="mt-14">
      <h2 id="recent-title" className="px-1 text-[13px] font-semibold tracking-wide text-mute uppercase">
        {INTAKE_TEXT.RECENT_TITLE}
      </h2>
      {isLoading ? (
        <div aria-hidden className="mt-3 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: RECENT_SKELETON_COUNT }, (_, position) => (
            <Skeleton key={position} className="h-[70px] rounded-2xl" />
          ))}
        </div>
      ) : null}
      {!isLoading && indexes.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {indexes.map((index) => (
            <li key={index.id}>
              <RecentIndexRow index={index} now={now} />
            </li>
          ))}
        </ul>
      ) : null}
      {!isLoading && indexes.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">
          {hasFailed ? INTAKE_TEXT.RECENT_FAILED : INTAKE_TEXT.RECENT_EMPTY}
        </p>
      ) : null}
    </section>
  )
}

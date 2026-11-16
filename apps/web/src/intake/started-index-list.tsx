import type { IndexView } from 'repotron-domain'

import { INTAKE_TEXT } from './intake.constants'
import { StartedIndexRow } from './started-index-row'

type StartedIndexListProps = { indexes: IndexView[] }

/** The indexes this browser started that are still running or failed. */
export function StartedIndexList({ indexes }: StartedIndexListProps) {
  if (indexes.length === 0) return null

  return (
    <section aria-labelledby="started-title" className="mt-14">
      <h2 id="started-title" className="px-1 text-[13px] font-semibold tracking-wide text-mute uppercase">
        {INTAKE_TEXT.STARTED_TITLE}
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {indexes.map((index) => (
          <li key={index.id}>
            <StartedIndexRow index={index} />
          </li>
        ))}
      </ul>
    </section>
  )
}

import type { Citation } from 'repotron-domain'

import { Skeleton } from '../ui/skeleton'
import { CitationCard } from './citation-card'
import { CitationPlaceholder } from './citation-placeholder'
import { CITATION_SKELETON_COUNT, CITATION_TEXT } from './citations.constants'

type CitationPanelProps = {
  citations: Citation[]
  /** The numbers that the answer text cites so far. */
  citedNumbers: readonly number[]
  focusedNumber: number | null
  /** True while the retrieval runs, before the sources arrive. */
  isLoading: boolean
}

/** The sources of one answer. At the `lg` width it stays in view while the answer scrolls. */
export function CitationPanel({ citations, citedNumbers, focusedNumber, isLoading }: CitationPanelProps) {
  const hasSources = citations.length > 0

  return (
    <aside
      aria-labelledby="sources-title"
      className="thin-scrollbar min-w-0 lg:sticky lg:top-[4.5rem] lg:-mr-2 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-2 lg:pb-4"
    >
      <h2
        id="sources-title"
        className="flex items-center gap-2 px-1 pb-3 text-[13px] font-semibold tracking-wide text-mute uppercase lg:sticky lg:top-0 lg:z-10 lg:bg-canvas/85 lg:backdrop-blur-sm"
      >
        {CITATION_TEXT.TITLE}
        {hasSources ? (
          <span className="rounded-full bg-ink/6 px-1.5 py-px font-mono text-[11px] text-ink-soft">
            {citations.length}
          </span>
        ) : null}
      </h2>
      {isLoading ? (
        <div aria-hidden className="space-y-3">
          {Array.from({ length: CITATION_SKELETON_COUNT }, (_, position) => (
            <Skeleton key={position} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : null}
      {!isLoading && hasSources ? (
        <ol className="animate-rise space-y-3">
          {citations.map((citation) => (
            <CitationCard
              key={citation.number}
              citation={citation}
              isCited={citedNumbers.includes(citation.number)}
              isFocused={focusedNumber === citation.number}
            />
          ))}
        </ol>
      ) : null}
      {!isLoading && !hasSources ? <CitationPlaceholder /> : null}
    </aside>
  )
}

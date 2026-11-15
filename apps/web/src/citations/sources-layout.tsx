import type { ReactNode } from 'react'

type SourcesLayoutProps = {
  /** The answer column. */
  children: ReactNode
  /** The sources panel. */
  sources: ReactNode
}

/**
 * Puts an answer and its sources side by side at the `lg` width, and the sources under the answer below it.
 * The bottom space sits inside the answer column at `lg`, so the row ends at the page bottom
 * and the sticky sources panel is never pushed under the header.
 */
export function SourcesLayout({ children, sources }: SourcesLayoutProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 pb-20 lg:grid-cols-[minmax(0,1fr)_25rem] lg:pb-0">
      <div className="min-w-0 lg:pb-20">{children}</div>
      {sources}
    </div>
  )
}

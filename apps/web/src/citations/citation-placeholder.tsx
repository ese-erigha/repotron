import { FileCode } from 'lucide-react'

import { CITATION_TEXT } from './citations.constants'

/** Holds the place of the sources before the first question. */
export function CitationPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-xl border border-line bg-surface text-mute shadow-card">
        <FileCode aria-hidden className="size-5" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink">{CITATION_TEXT.PLACEHOLDER_TITLE}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-mute">{CITATION_TEXT.PLACEHOLDER_TEXT}</p>
    </div>
  )
}

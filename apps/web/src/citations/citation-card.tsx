import type { Citation } from 'repotron-domain'

import { cn } from '../ui/cn'
import { CitationCardHeader } from './citation-card-header'
import { citationAnchor } from './citations.constants'
import { CodeLines } from './code-lines'

type CitationCardProps = {
  citation: Citation
  /** True when the answer text holds the number of this source. */
  isCited: boolean
  /** True for a short time after the user selects the number of this source. */
  isFocused: boolean
}

export function CitationCard({ citation, isCited, isFocused }: CitationCardProps) {
  return (
    <li
      id={citationAnchor(citation.number)}
      className={cn(
        'surface-card scroll-mt-24 p-3.5 transition-[border-color,box-shadow] duration-300',
        isFocused && 'animate-flash border-accent shadow-focus',
      )}
    >
      <CitationCardHeader citation={citation} isCited={isCited} />
      <div className="mt-3">
        <CodeLines content={citation.content} startLine={citation.startLine} />
      </div>
    </li>
  )
}

import { ArrowUpRight } from 'lucide-react'
import type { Citation } from 'repotron-domain'

import { cn } from '../ui/cn'
import { ExternalLink } from '../ui/external-link'
import { CHUNK_KIND_LABEL, CITATION_TEXT } from './citations.constants'

type CitationCardHeaderProps = {
  citation: Citation
  isCited: boolean
}

/** The number, the file, the symbol, and the line range of a source. */
export function CitationCardHeader({ citation, isCited }: CitationCardHeaderProps) {
  const splitAt = citation.path.lastIndexOf('/') + 1
  const folder = citation.path.slice(0, splitAt)
  const fileName = citation.path.slice(splitAt)
  const symbol = citation.symbol === null ? '' : ` ${citation.symbol}`

  return (
    <div className="flex items-start gap-3">
      <span
        title={isCited ? CITATION_TEXT.CITED : undefined}
        className={cn(
          'mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 font-mono text-xs font-semibold transition-colors duration-300',
          isCited ? 'bg-accent text-white' : 'border border-line-strong bg-surface text-mute',
        )}
      >
        {citation.number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex font-mono text-[13px] leading-snug" title={citation.path}>
          <span className="truncate text-mute">{folder}</span>
          <span className="shrink-0 font-semibold text-ink">{fileName}</span>
        </p>
        <p className="mt-1 flex text-xs text-mute">
          <span className="truncate">
            {CHUNK_KIND_LABEL[citation.kind]}
            <span className="font-mono text-ink-soft">{symbol}</span>
          </span>
          <span className="shrink-0">
            <span aria-hidden className="mx-1.5 text-line-strong">
              ·
            </span>
            {CITATION_TEXT.LINES} {citation.startLine}–{citation.endLine}
          </span>
        </p>
      </div>
      <ExternalLink
        href={citation.githubUrl}
        aria-label={`${CITATION_TEXT.OPEN_ON_GITHUB}: ${citation.path}`}
        title={CITATION_TEXT.OPEN_ON_GITHUB}
        className="-mt-0.5 -mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-sunken hover:text-ink"
      >
        <ArrowUpRight aria-hidden className="size-4" />
      </ExternalLink>
    </div>
  )
}

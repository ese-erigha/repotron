import { useMemo } from 'react'
import Markdown, { type Components } from 'react-markdown'

import { readCitationAnchor } from '../citations/citations.constants'
import { ExternalLink } from '../ui/external-link'
import { CitationMarker } from './citation-marker'
import { linkCitationMarkers } from './link-citation-markers'

type AnswerViewProps = {
  /** The answer as Markdown, with a marker such as `[2]` after each claim. */
  text: string
  /** The numbers of the sources that the panel shows. Only these markers become links. */
  sourceNumbers: readonly number[]
  isStreaming: boolean
  onSelectCitation(number: number): void
}

/**
 * Renders the answer text. The renderer gets no raw HTML plugin,
 * so text from a repository cannot add HTML to the page.
 */
export function AnswerView({ text, sourceNumbers, isStreaming, onSelectCitation }: AnswerViewProps) {
  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        const number = href === undefined ? undefined : readCitationAnchor(href)
        if (number !== undefined) return <CitationMarker number={number} onSelect={onSelectCitation} />
        return (
          <ExternalLink href={href} className="font-medium text-accent-strong underline underline-offset-2">
            {children}
          </ExternalLink>
        )
      },
    }),
    [onSelectCitation],
  )

  return (
    <div className="answer-prose" data-streaming={isStreaming}>
      <Markdown components={components}>{linkCitationMarkers(text, sourceNumbers)}</Markdown>
    </div>
  )
}

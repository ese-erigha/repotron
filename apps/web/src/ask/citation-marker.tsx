import type { MouseEvent } from 'react'

import { citationAnchor } from '../citations/citations.constants'
import { ASK_TEXT } from './ask.constants'

type CitationMarkerProps = {
  number: number
  onSelect(number: number): void
}

/**
 * The number of a source inside the answer text. A select shows that source.
 * It is an inline link to the source card, so a line never breaks between the number and its claim.
 */
export function CitationMarker({ number, onSelect }: CitationMarkerProps) {
  function selectSource(event: MouseEvent<HTMLAnchorElement>) {
    // The panel scrolls to the source. The address of the page stays the same.
    event.preventDefault()
    onSelect(number)
  }

  return (
    <a
      href={`#${citationAnchor(number)}`}
      aria-label={`${ASK_TEXT.SOURCE} ${number}`}
      onClick={selectSource}
      className="rounded-md bg-accent-soft px-[0.42em] py-[0.14em] align-[0.08em] font-mono text-[0.72em] font-semibold text-accent-strong transition-colors duration-150 hover:bg-accent hover:text-white"
    >
      {number}
    </a>
  )
}

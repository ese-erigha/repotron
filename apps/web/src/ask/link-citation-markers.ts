import { citationAnchor } from '../citations/citations.constants'

/** A fenced block, also one that the stream did not close yet, or a code span. */
const CODE_SEGMENT = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/

/** A marker such as `[3]` that is not already the text of a link, with the space before it. */
const CITATION_MARKER = /( ?)\[(\d+)\](?!\()/g

/** A space that does not break, so a marker never starts a line apart from its claim. */
const NO_BREAK_SPACE = '\u00A0'

/**
 * Changes each citation marker of the answer into a Markdown link to its source card.
 * A number with no source stays as text, and so does a marker inside code.
 */
export function linkCitationMarkers(text: string, sourceNumbers: readonly number[]): string {
  const segments = text.split(CODE_SEGMENT)
  const linked = segments.map((segment, position) => {
    // `split` with one capture group puts each code segment at an odd position.
    if (position % 2 === 1) return segment
    return segment.replace(CITATION_MARKER, (marker, space: string, digits: string) => {
      const number = Number(digits)
      if (!sourceNumbers.includes(number)) return marker
      return `${space === '' ? '' : NO_BREAK_SPACE}[${number}](#${citationAnchor(number)})`
    })
  })
  return linked.join('')
}

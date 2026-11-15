import { useCallback, useEffect, useRef, useState } from 'react'

import { CITATION_FOCUS_MS, CITATION_PANEL_OFFSET_PX, citationAnchor } from './citations.constants'

export type CitationFocus = {
  /** The number of the highlighted source, or null. */
  focusedNumber: number | null
  /** Scrolls to a source card and highlights it for a short time. */
  focusCitation(number: number): void
}

export function useCitationFocus(): CitationFocus {
  const [focusedNumber, setFocusedNumber] = useState<number | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const focusCitation = useCallback((number: number) => {
    window.clearTimeout(timerRef.current)
    showSourceCard(document.getElementById(citationAnchor(number)))
    setFocusedNumber(number)
    timerRef.current = window.setTimeout(setFocusedNumber, CITATION_FOCUS_MS, null)
  }, [])

  return { focusedNumber, focusCitation }
}

/**
 * Brings a source card into view. At the `lg` width the sources panel scrolls inside its own height,
 * so only the panel moves and the answer keeps its place. Below `lg`, the page scrolls to the card.
 */
function showSourceCard(card: HTMLElement | null): void {
  if (card === null) return
  const panel = card.closest('aside')
  if (panel === null || panel.scrollHeight <= panel.clientHeight) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  panel.scrollTo({ top: card.offsetTop - CITATION_PANEL_OFFSET_PX, behavior: 'smooth' })
}

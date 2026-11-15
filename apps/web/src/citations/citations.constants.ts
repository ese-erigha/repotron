import { CHUNK_KIND, type ChunkKind } from 'repotron-domain'

export const CITATION_TEXT = {
  TITLE: 'Sources',
  LINES: 'Lines',
  OPEN_ON_GITHUB: 'Open on GitHub',
  CITED: 'Cited in the answer',
  PLACEHOLDER_TITLE: 'Sources show here',
  PLACEHOLDER_TEXT: 'Each answer lists the files and the lines that it comes from. Select a number in the answer to see its source.',
} as const

export const CHUNK_KIND_LABEL: Record<ChunkKind, string> = {
  [CHUNK_KIND.function]: 'Function',
  [CHUNK_KIND.method]: 'Method',
  [CHUNK_KIND.class]: 'Class',
  [CHUNK_KIND.interface]: 'Interface',
  [CHUNK_KIND.type]: 'Type',
  [CHUNK_KIND.module]: 'Module',
  [CHUNK_KIND.heading]: 'Section',
  [CHUNK_KIND.window]: 'Text',
}

const CITATION_ANCHOR_PREFIX = 'citation-'

/** How long a source stays highlighted after the user selects its number. */
export const CITATION_FOCUS_MS = 2_000

/** The space above a source card after the panel scrolls to it. The sticky title of the panel covers that space. */
export const CITATION_PANEL_OFFSET_PX = 44

/** The count of placeholder cards while the retrieval runs. */
export const CITATION_SKELETON_COUNT = 3

/** The element id of a source card. A citation marker in the answer links to it. */
export function citationAnchor(number: number): string {
  return `${CITATION_ANCHOR_PREFIX}${number}`
}

/** Reads the source number of a link to a source card. Any other link gives undefined. */
export function readCitationAnchor(href: string): number | undefined {
  if (!href.startsWith(`#${CITATION_ANCHOR_PREFIX}`)) return undefined
  const number = Number(href.slice(CITATION_ANCHOR_PREFIX.length + 1))
  return Number.isInteger(number) && number > 0 ? number : undefined
}

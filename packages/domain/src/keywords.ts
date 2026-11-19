import { CONTEXT_CHUNKS, RRF_K } from './limits.ts'

const CAMEL_PART = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g

const ROLE_WORDS = new Set<string>([
  'function',
  'method',
  'class',
  'defined',
  'declared',
  'schema',
  'type',
  'decorator',
])

const CLOSED_CLASS_WORDS = new Set<string>([
  'a',
  'an',
  'another',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'do',
  'does',
  'did',
  'of',
  'to',
  'in',
  'on',
  'for',
  'from',
  'into',
  'with',
  'and',
  'or',
  'but',
  'where',
  'how',
  'what',
  'when',
  'who',
  'why',
  'which',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'i',
])

export const RETRIEVAL_MODE = {
  dense: 'dense',
  bm25: 'bm25',
  hybrid: 'hybrid',
} as const

export function keywordMatch(question: string): string {
  const terms: string[] = []
  const seen = new Set<string>()
  for (const word of question.match(/[A-Za-z0-9_-]+/g) ?? []) {
    if (CLOSED_CLASS_WORDS.has(word.toLowerCase())) continue
    for (const term of keywordTerms(word)) {
      if (seen.has(term)) continue
      seen.add(term)
      terms.push(`"${term.replaceAll('"', '""')}"`)
    }
  }
  return terms.join(' OR ')
}

export function promoteSymbolHit<T extends { symbol: string | null }>(chunks: T[], question: string): T[] {
  if (!question.toLowerCase().startsWith('where is ')) return chunks
  const name = questionNames(question).at(-1)?.toLowerCase()
  if (!name) return chunks
  const match = chunks.findIndex((chunk) => chunk.symbol?.toLowerCase() === name)
  if (match <= 0) return chunks
  const next = [...chunks]
  const [hit] = next.splice(match, 1)
  return hit ? [hit, ...next] : chunks
}

export function blendSearches<T extends { id: string; symbol: string | null }>(
  semantic: T[],
  keyword: T[],
  question: string,
): T[] {
  const head = promoteSymbolHit(semantic.slice(0, CONTEXT_CHUNKS), question)
  const keywordHit = keyword[0]
  if (!keywordHit) return head
  if (!semantic.some((chunk) => chunk.id === keywordHit.id)) return head
  if (head.some((chunk) => chunk.id === keywordHit.id)) return head
  return [...head.slice(0, CONTEXT_CHUNKS - 1), keywordHit]
}

export function fuseRanks(denseIds: string[], keywordIds: string[]): string[] {
  const scores = new Map<string, number>()
  addRanks(scores, denseIds)
  addRanks(scores, keywordIds)
  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => id)
}

function addRanks(scores: Map<string, number>, ids: string[]): void {
  ids.forEach((id, index) => {
    const rank = index + 1
    const score = 1 / (RRF_K + rank)
    scores.set(id, (scores.get(id) ?? 0) + score)
  })
}

function questionNames(question: string): string[] {
  const names: string[] = []
  for (const word of question.match(/[A-Za-z0-9_-]+/g) ?? []) {
    const lower = word.toLowerCase()
    if (CLOSED_CLASS_WORDS.has(lower) || ROLE_WORDS.has(lower)) continue
    names.push(word)
  }
  return names
}

function keywordTerms(word: string): string[] {
  const parts: string[] = []
  for (const piece of word.replaceAll('-', '_').split('_')) {
    if (piece === '') continue
    const found = piece.match(CAMEL_PART)
    parts.push(...(found ?? [piece]))
  }
  const phrase = parts.map((part) => part.toLowerCase()).join(' ')
  if (phrase === '' || phrase === word.toLowerCase()) return [word]
  return [word, ...parts.map((part) => part.toLowerCase())]
}

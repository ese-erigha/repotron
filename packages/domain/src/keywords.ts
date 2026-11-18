const CAMEL_PART = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g

export const RETRIEVAL_MODE = {
  bm25: 'bm25',
} as const

export function keywordMatch(question: string): string {
  const terms: string[] = []
  const seen = new Set<string>()
  for (const word of question.match(/[A-Za-z0-9_-]+/g) ?? []) {
    for (const term of keywordTerms(word)) {
      if (seen.has(term)) continue
      seen.add(term)
      terms.push(`"${term.replaceAll('"', '""')}"`)
    }
  }
  return terms.join(' OR ')
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

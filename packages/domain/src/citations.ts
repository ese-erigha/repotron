const CITATION_MARKER = /\[(\d+)\]/g

export function readCitedNumbers(answer: string, sourceCount: number): number[] {
  const numbers: number[] = []
  for (const match of answer.matchAll(CITATION_MARKER)) {
    const raw = match[1]
    if (!raw) continue
    const number = Number(raw)
    if (number < 1 || number > sourceCount || numbers.includes(number)) continue
    numbers.push(number)
  }
  return numbers
}

import { readCitedNumbers } from 'repotron-domain'

import type { FixtureAnswer, FixtureRepository } from './fixture-repository.ts'

/**
 * Lists each mistake in the handwritten data of a fixture repository.
 * An empty list means that each answer cites chunks that exist, and each chunk has the lines of its range.
 */
export function findFixtureProblems(repository: FixtureRepository): string[] {
  const answers = [repository.overview, repository.startHere, ...repository.topics, ...repository.features]
  return [...findChunkProblems(repository), ...answers.flatMap((answer) => findAnswerProblems(repository, answer))]
}

function findChunkProblems(repository: FixtureRepository): string[] {
  return Object.entries(repository.chunks).flatMap(([key, chunk]) => {
    const lineCount = chunk.content.split('\n').length
    const rangeSize = chunk.endLine - chunk.startLine + 1
    return lineCount === rangeSize ? [] : [`The chunk "${key}" has ${lineCount} lines for a range of ${rangeSize}.`]
  })
}

function findAnswerProblems(repository: FixtureRepository, answer: FixtureAnswer): string[] {
  const missing = answer.sources.filter((key) => repository.chunks[key] === undefined)
  // Code such as `matchResult[0]` holds brackets that are not citations.
  const prose = answer.text.replace(/`[^`\n]*`/g, '')
  const markers = [...prose.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]))
  const cited = readCitedNumbers(prose, answer.sources.length)
  const outOfRange = markers.filter((number) => !cited.includes(number))
  return [
    ...missing.map((key) => `An answer lists the source "${key}", which is not a chunk.`),
    ...outOfRange.map((number) => `An answer cites [${number}], but it has ${answer.sources.length} sources.`),
  ]
}

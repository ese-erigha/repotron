import type { Citation } from 'repotron-domain'

/** One indexed chunk, before retrieval gives it a number and a GitHub link. */
export type FixtureChunk = Omit<Citation, 'number' | 'githubUrl'>

export type FixtureAnswer = {
  /** Chunk keys in retrieval order. The text cites each one by its position, from 1. */
  sources: readonly string[]
  text: string
}

export type KeywordAnswer = FixtureAnswer & {
  /** The answer matches a question that holds one of these words. */
  keywords: readonly string[]
}

export type FixtureRepository = {
  id: string
  owner: string
  name: string
  commitSha: string
  fileCount: number
  chunkCount: number
  chunks: Record<string, FixtureChunk>
  /** The answer to a question that matches no topic. */
  overview: FixtureAnswer
  startHere: FixtureAnswer
  topics: readonly KeywordAnswer[]
  features: readonly KeywordAnswer[]
}

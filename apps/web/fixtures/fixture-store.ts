import {
  buildGithubLineUrl,
  buildIndexId,
  INDEX_STATUS,
  readCitedNumbers,
  RECENT_INDEX_COUNT,
  type Citation,
  type IndexView,
  type QuestionView,
  type RepositoryLink,
} from 'repotron-domain'

import { scriptAnswer, type ScriptedAnswer } from './answer-script.ts'
import type { FixtureRepository } from './data/fixture-repository.ts'
import { buildGenericRepository, hashOf } from './data/generic.fixture.ts'
import { SEED_INDEXES, SEED_QUESTIONS, type SeedQuestion } from './data/seed-repositories.ts'
import { INDEX_TIMELINE, readyAfterMs, statusAt, type IndexTimeline } from './index-timeline.ts'
import { LINK_ERROR, LINK_SCENARIO, PARSING_FAILURE_REASON, type FixtureError } from './scenarios.ts'

const EARLIER_COMMIT_AGE_MS = 3 * 24 * 3_600_000

export type StoredIndex = {
  id: string
  repository: FixtureRepository
  commitSha: string
  createdAt: number
  /** The time the job started or restarted. The status follows the time since this value. */
  startedAt: number
  timeline: IndexTimeline
}

export type RequestIndexResult = { status: 200 | 201; index: IndexView }

export type AnsweredQuestion = {
  id: string
  index: StoredIndex
  answer: ScriptedAnswer
  citations: Citation[]
  createdAt: number
}

/** The connection drops before a response. The dev server closes the socket. */
export class FixtureDisconnect extends Error {
  constructor() {
    super('The connection dropped.')
    this.name = 'FixtureDisconnect'
  }
}

/** A request that the gateway refuses. The route layer sends it as the error envelope. */
export class FixtureRequestError extends Error {
  readonly detail: FixtureError

  constructor(detail: FixtureError, options?: ErrorOptions) {
    super(detail.message, options)
    this.detail = detail
  }
}

/** The indexes and the answers of the dev server. They live in memory until the server stops. */
export class FixtureStore {
  private readonly indexes = new Map<string, StoredIndex>()
  private readonly questions = new Map<string, QuestionView>()

  constructor(now: number) {
    for (const seed of SEED_INDEXES) {
      this.addIndex(seed.repository, seed.repository.commitSha, now - seed.readyAgoMs, INDEX_TIMELINE.ready)
    }
    for (const seed of SEED_QUESTIONS) this.addSeedQuestion(seed, now)
  }

  /** Lists the newest ready index of each repository. The pipeline deletes the earlier ones. */
  listRecentIndexes(now: number): IndexView[] {
    const views = [...this.indexes.values()].map((index) => this.viewOf(index, now))
    const ready = views.filter((view) => view.status === INDEX_STATUS.ready)
    ready.sort((left, right) => (right.readyAt ?? 0) - (left.readyAt ?? 0))
    const seenRepositories = new Set<string>()
    const newest = ready.filter((view) => {
      const fullName = `${view.repository.owner}/${view.repository.name}`
      const isNewest = !seenRepositories.has(fullName)
      seenRepositories.add(fullName)
      return isNewest
    })
    return newest.slice(0, RECENT_INDEX_COUNT)
  }

  getIndex(indexId: string): StoredIndex | undefined {
    return this.indexes.get(indexId)
  }

  getQuestion(questionId: string): QuestionView | undefined {
    return this.questions.get(questionId)
  }

  /** Starts an index job, returns the existing index, or restarts a failed one. */
  requestIndex(link: RepositoryLink, now: number): RequestIndexResult {
    const fullName = `${link.owner}/${link.name}`.toLowerCase()
    const error = LINK_ERROR[fullName]
    if (error) throw new FixtureRequestError(error)
    const repository = this.findRepository(fullName) ?? buildGenericRepository(link)
    if (fullName === LINK_SCENARIO.newCommit) this.addEarlierCommit(repository, now)
    const existing = this.indexes.get(buildIndexId(repository.id, repository.commitSha))
    if (existing) return { status: 200, index: this.reuseIndex(existing, now) }
    const created = this.addIndex(repository, repository.commitSha, now, timelineFor(fullName))
    return { status: 201, index: this.viewOf(created, now) }
  }

  viewOf(index: StoredIndex, now: number): IndexView {
    const status = statusAt(index.timeline, now - index.startedAt)
    const isReady = status === INDEX_STATUS.ready
    const isFailed = status === INDEX_STATUS.failed
    const hasFileCount = isReady || status === INDEX_STATUS.embedding
    return {
      id: index.id,
      repository: { owner: index.repository.owner, name: index.repository.name },
      commitSha: index.commitSha,
      status,
      failedStage: isFailed ? INDEX_STATUS.parsing : null,
      failureReason: isFailed ? PARSING_FAILURE_REASON : null,
      fileCount: hasFileCount ? index.repository.fileCount : null,
      chunkCount: isReady ? index.repository.chunkCount : null,
      fallbackIndexId: isReady ? null : this.findReadyIndexId(index, now),
      createdAt: index.createdAt,
      readyAt: isReady ? index.startedAt + readyAfterMs(index.timeline) : null,
    }
  }

  /** Gives each source of the answer its number and its GitHub link at the commit of the index. */
  citationsOf(index: StoredIndex, sources: readonly string[]): Citation[] {
    return sources.map((key, position) => {
      const chunk = index.repository.chunks[key]
      if (!chunk) throw new Error(`The fixture chunk "${key}" does not exist.`)
      const githubUrl = buildGithubLineUrl({
        owner: index.repository.owner,
        name: index.repository.name,
        commitSha: index.commitSha,
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
      })
      return { number: position + 1, ...chunk, githubUrl }
    })
  }

  /** Stores the answer with only the sources that its text cites, as the gateway does. */
  saveQuestion(answered: AnsweredQuestion): void {
    const cited = new Set(readCitedNumbers(answered.answer.text, answered.citations.length))
    const view: QuestionView = {
      id: answered.id,
      repositoryFullName: `${answered.index.repository.owner}/${answered.index.repository.name}`,
      commitSha: answered.index.commitSha,
      preset: answered.answer.preset,
      question: answered.answer.question,
      answer: answered.answer.text,
      citations: answered.citations.filter((citation) => cited.has(citation.number)),
      createdAt: answered.createdAt,
    }
    this.questions.set(view.id, view)
  }

  private addIndex(
    repository: FixtureRepository,
    commitSha: string,
    createdAt: number,
    timeline: IndexTimeline,
  ): StoredIndex {
    const index: StoredIndex = {
      id: buildIndexId(repository.id, commitSha),
      repository,
      commitSha,
      createdAt,
      startedAt: createdAt,
      timeline,
    }
    this.indexes.set(index.id, index)
    return index
  }

  private addSeedQuestion(seed: SeedQuestion, now: number): void {
    const index = this.indexes.get(buildIndexId(seed.repository.id, seed.repository.commitSha))
    if (!index) throw new Error(`The seed question "${seed.id}" has no index.`)
    const answer = scriptAnswer(seed.repository, { question: seed.question })
    const citations = this.citationsOf(index, answer.sources)
    this.saveQuestion({ id: seed.id, index, answer, citations, createdAt: now - seed.askedAgoMs })
  }

  private findRepository(fullName: string): FixtureRepository | undefined {
    const indexes = [...this.indexes.values()]
    const match = indexes.find((index) => fullNameOf(index.repository) === fullName)
    return match?.repository
  }

  /** The new-commit scenario needs a ready index at an earlier commit, so the UI has a fallback. */
  private addEarlierCommit(repository: FixtureRepository, now: number): void {
    if (this.findRepository(fullNameOf(repository))) return
    const earlierSha = hashOf(`earlier:${fullNameOf(repository)}`)
    this.addIndex(repository, earlierSha, now - EARLIER_COMMIT_AGE_MS, INDEX_TIMELINE.ready)
  }

  private reuseIndex(index: StoredIndex, now: number): IndexView {
    if (statusAt(index.timeline, now - index.startedAt) === INDEX_STATUS.failed) {
      index.startedAt = now
      index.timeline = INDEX_TIMELINE.normal
    }
    return this.viewOf(index, now)
  }

  private findReadyIndexId(current: StoredIndex, now: number): string | null {
    const others = [...this.indexes.values()].filter(
      (index) => index.repository.id === current.repository.id && index.id !== current.id,
    )
    const ready = others.filter((index) => statusAt(index.timeline, now - index.startedAt) === INDEX_STATUS.ready)
    ready.sort((left, right) => right.createdAt - left.createdAt)
    return ready[0]?.id ?? null
  }
}

function fullNameOf(repository: FixtureRepository): string {
  return `${repository.owner}/${repository.name}`.toLowerCase()
}

function timelineFor(fullName: string): IndexTimeline {
  if (fullName === LINK_SCENARIO.failsParsing) return INDEX_TIMELINE.failsAtParsing
  if (fullName === LINK_SCENARIO.slow) return INDEX_TIMELINE.slow
  if (fullName === LINK_SCENARIO.newCommit) return INDEX_TIMELINE.reindex
  return INDEX_TIMELINE.normal
}

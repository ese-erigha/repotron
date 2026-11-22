import {
  buildIndexId,
  EMBEDDING_MODEL_ID,
  ERROR_CODE,
  INDEX_STATUS,
  parseRepositoryLink,
  type IndexView,
} from 'repotron-domain'

import { log } from 'log'

import { getRepositories, getRepositoryIndexing } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { consumeLimit, RATE_LIMIT_KIND } from '../consume-limit.ts'
import {
  countRepositoryFiles,
  readGithubRepository,
  readHeadCommit,
  type GithubRepository,
} from '../github-repository.ts'
import { toIndexView } from '../index-view.ts'
import { verifyTurnstile } from '../verify-turnstile.ts'

export type RequestIndexInput = { url: string; turnstileToken: string; remoteIp: string }
export type StartPublicIndexInput = { url: string; remoteIp: string }
export type RequestIndexResult = { status: 200 | 201; index: IndexView }

export async function requestIndex(input: RequestIndexInput): Promise<RequestIndexResult> {
  await verifyTurnstile(input.turnstileToken, input.remoteIp)
  return startPublicIndex({ url: input.url, remoteIp: input.remoteIp })
}

/** Starts an index for a public repository. The caller already checked the agent token. */
export async function startPublicIndex(input: StartPublicIndexInput): Promise<RequestIndexResult> {
  await consumeLimit(RATE_LIMIT_KIND.index, input.remoteIp)
  const link = parseRepositoryLink(input.url)
  if (!link) throw new RequestError(400, ERROR_CODE.validationFailed, 'The repository link is invalid.')
  const repository = await readGithubRepository(link)
  const commitSha = await readHeadCommit(link, repository.defaultBranch)
  const indexId = buildIndexId(repository.id, commitSha)
  const existing = await reuseIndex(indexId, repository)
  if (existing) return { status: 200, index: existing }
  await countRepositoryFiles(link, commitSha)
  const created = await createIndex({ repository, commitSha, indexId })
  return { status: 201, index: created }
}

async function reuseIndex(indexId: string, repository: GithubRepository): Promise<IndexView | undefined> {
  const row = await getRepositories().repositoryIndexes.get(indexId)
  if (!row) return undefined
  if (row.status !== INDEX_STATUS.failed) return toIndexView(row, repository)
  await getRepositories().repositoryIndexes.resetToQueued({ id: indexId, now: Date.now() })
  await getRepositoryIndexing().get(indexId).restart()
  const reset = await getRepositories().repositoryIndexes.get(indexId)
  if (!reset) throw new RequestError(500, ERROR_CODE.internal, 'Something went wrong.')
  return toIndexView(reset, repository)
}

async function createIndex(input: {
  repository: GithubRepository
  commitSha: string
  indexId: string
}): Promise<IndexView> {
  const now = Date.now()
  await getRepositories().githubRepositories.upsert({
    id: input.repository.id,
    owner: input.repository.owner,
    name: input.repository.name,
    defaultBranch: input.repository.defaultBranch,
    now,
  })
  await getRepositories().repositoryIndexes.insertQueued({
    id: input.indexId,
    repositoryId: input.repository.id,
    commitSha: input.commitSha,
    embeddingModelId: EMBEDDING_MODEL_ID,
    now,
  })
  await startWorkflow(input)
  const row = await getRepositories().repositoryIndexes.get(input.indexId)
  if (!row) throw new RequestError(500, ERROR_CODE.internal, 'Something went wrong.')
  return toIndexView(row, input.repository)
}

async function startWorkflow(input: { repository: GithubRepository; commitSha: string; indexId: string }): Promise<void> {
  try {
    await getRepositoryIndexing().create({
      id: input.indexId,
      params: {
        indexId: input.indexId,
        owner: input.repository.owner,
        name: input.repository.name,
        commitSha: input.commitSha,
      },
    })
  } catch (error) {
    if (isExistingInstance(error)) return
    log.error('index_start_failed', input.indexId, error)
    await getRepositories().repositoryIndexes.markFailed({
      id: input.indexId,
      failedStage: INDEX_STATUS.queued,
      failureReason: 'Indexing failed at the queued stage.',
      now: Date.now(),
    })
    throw new RequestError(503, ERROR_CODE.githubUnavailable, 'The index job did not start.')
  }
}

function isExistingInstance(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('already exists')
}

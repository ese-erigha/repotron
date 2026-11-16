import {
  ERROR_CODE,
  REPOSITORY_MAX_FILES,
  REPOSITORY_MAX_KILOBYTES,
  type RepositoryLink,
} from 'repotron-domain'

import { log } from 'log'

import { getConfig } from '../../context.ts'
import { RequestError } from '../../http-error.ts'

export const REPOSITORY_NOT_FOUND = 'This repository does not exist or is private.'

export type GithubRepository = {
  id: string
  owner: string
  name: string
  defaultBranch: string
  sizeKilobytes: number
  private: boolean
}

export async function readGithubRepository(link: RepositoryLink): Promise<GithubRepository> {
  const body = await githubJson(`/repos/${link.owner}/${link.name}`)
  if (body.private === true) throw new RequestError(404, ERROR_CODE.repositoryNotFound, REPOSITORY_NOT_FOUND)
  const size = numberField(body, 'size')
  if (size > REPOSITORY_MAX_KILOBYTES) {
    throw new RequestError(400, ERROR_CODE.repositoryTooLarge, 'The repository is larger than 500 MB.')
  }
  const id = body.id
  const owner = nestedString(body, 'owner', 'login') ?? link.owner
  const name = stringField(body, 'name') ?? link.name
  const defaultBranch = stringField(body, 'default_branch')
  if (typeof id !== 'number' || !defaultBranch) throw githubUnavailable()
  return { id: String(id), owner, name, defaultBranch, sizeKilobytes: size, private: false }
}

export async function readHeadCommit(link: RepositoryLink, branch: string): Promise<string> {
  const body = await githubJson(`/repos/${link.owner}/${link.name}/branches/${branch}`)
  const sha = nestedString(body, 'commit', 'sha')
  if (!sha) throw githubUnavailable()
  return sha
}

export async function countRepositoryFiles(link: RepositoryLink, commitSha: string): Promise<number> {
  const body = await githubJson(`/repos/${link.owner}/${link.name}/git/trees/${commitSha}?recursive=1`)
  if (body.truncated === true) {
    throw new RequestError(400, ERROR_CODE.repositoryTooLarge, fileLimitMessage())
  }
  const tree = Array.isArray(body.tree) ? body.tree : []
  const blobs = tree.filter((entry) => isRecord(entry) && entry.type === 'blob').length
  if (blobs > REPOSITORY_MAX_FILES) throw new RequestError(400, ERROR_CODE.repositoryTooLarge, fileLimitMessage())
  return blobs
}

async function githubJson(path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${getConfig().GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'repotron',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (response.status === 404) throw new RequestError(404, ERROR_CODE.repositoryNotFound, REPOSITORY_NOT_FOUND)
  if (response.status === 403 || response.status === 429 || response.status >= 500 || !response.ok) {
    log.error('github_failed', path, response.status)
    throw githubUnavailable()
  }
  const body: unknown = await response.json()
  if (!isRecord(body)) throw githubUnavailable()
  return body
}

function fileLimitMessage(): string {
  return `The repository has more than ${REPOSITORY_MAX_FILES} files.`
}

function githubUnavailable(): RequestError {
  return new RequestError(503, ERROR_CODE.githubUnavailable, 'GitHub is unavailable.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key]
  return typeof value === 'string' ? value : undefined
}

function numberField(body: Record<string, unknown>, key: string): number {
  const value = body[key]
  return typeof value === 'number' ? value : 0
}

function nestedString(body: Record<string, unknown>, key: string, child: string): string | undefined {
  const value = body[key]
  if (!isRecord(value)) return undefined
  const nested = value[child]
  return typeof nested === 'string' ? nested : undefined
}

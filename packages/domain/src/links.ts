export type RepositoryLink = {
  owner: string
  name: string
}

const REPOSITORY_LINK =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/

export function parseRepositoryLink(value: string): RepositoryLink | undefined {
  const match = REPOSITORY_LINK.exec(value)
  if (!match) return undefined
  const owner = match[1]
  const name = match[2]
  if (!owner || !name || owner === '.' || owner === '..' || name === '.' || name === '..') {
    return undefined
  }
  return { owner, name }
}

export function buildIndexId(repositoryId: string, commitSha: string): string {
  return `${repositoryId}-${commitSha}`
}

export function buildChunkId(indexId: string, seq: number): string {
  return `${indexId}:${seq}`
}

export type GithubLineLink = {
  owner: string
  name: string
  commitSha: string
  path: string
  startLine: number
  endLine: number
}

export function buildGithubLineUrl(link: GithubLineLink): string {
  const file = `${link.owner}/${link.name}/blob/${link.commitSha}/${link.path}`
  return `https://github.com/${file}#L${link.startLine}-L${link.endLine}`
}

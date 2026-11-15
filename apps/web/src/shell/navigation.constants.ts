export const HOME_PATH = '/'
export const REPOSITORY_ROUTE = '/r/:owner/:repo'
export const ANSWER_ROUTE = '/a/:id'
export const NOT_FOUND_ROUTE = '*'

/** The query value that holds the index id on the repository route. */
export const INDEX_QUERY = 'index'

export function repositoryPath(owner: string, repo: string, indexId?: string): string {
  const path = `/r/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  if (indexId === undefined) return path
  const query = new URLSearchParams({ [INDEX_QUERY]: indexId })
  return `${path}?${query.toString()}`
}

export function answerPath(questionId: string): string {
  return `/a/${encodeURIComponent(questionId)}`
}

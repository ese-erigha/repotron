import { ERROR_CODE, type IndexView } from 'repotron-domain'

import { getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { toIndexView } from '../index-view.ts'

export async function readIndex(indexId: string): Promise<IndexView> {
  const row = await getRepositories().repositoryIndexes.get(indexId)
  if (!row) throw new RequestError(404, ERROR_CODE.notFound, 'The index does not exist.')
  const repository = await getRepositories().githubRepositories.get(row.repositoryId)
  if (!repository) throw new RequestError(404, ERROR_CODE.notFound, 'The index does not exist.')
  return toIndexView(row, repository)
}

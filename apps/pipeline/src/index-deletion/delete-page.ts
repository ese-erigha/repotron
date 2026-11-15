import { DELETE_PAGE_SIZE } from 'repotron-domain'

import { getRepositories, getVectors } from '../context.ts'

export async function deleteNextPage(indexId: string): Promise<boolean> {
  const ids = await getRepositories().sourceChunks.listIdPage({ indexId, limit: DELETE_PAGE_SIZE })
  const lastId = ids[ids.length - 1]
  if (!lastId) return false
  await getVectors().deleteByIds(ids)
  await getRepositories().sourceChunks.deleteThrough({ indexId, lastId })
  return true
}

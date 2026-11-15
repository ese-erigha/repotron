import { RECENT_INDEX_COUNT, type IndexView } from 'repotron-domain'

import { getRepositories } from '../../../context.ts'
import { toReadyView } from '../index-view.ts'

export async function listRecentIndexes(): Promise<{ indexes: IndexView[] }> {
  const rows = await getRepositories().repositoryIndexes.listRecentReady(RECENT_INDEX_COUNT)
  const repositories = await getRepositories().githubRepositories.listByIds(rows.map((row) => row.repositoryId))
  const byId = new Map(repositories.map((repository) => [repository.id, repository]))
  const indexes = rows.flatMap((row) => {
    const repository = byId.get(row.repositoryId)
    return repository ? [toReadyView(row, repository)] : []
  })
  return { indexes }
}

// Trigger a staging deploy.
import { deleteStaleIndexes } from './delete-stale-indexes/delete-stale-indexes.ts'
import { pipelineContext, pipelineStorage } from './context.ts'
import { Indexer } from './indexer-container/indexer-container.ts'
import { IndexDeletion } from './index-deletion/index-deletion.ts'
import { RepositoryIndexing } from './repository-indexing/repository-indexing.ts'

export { IndexDeletion, Indexer, RepositoryIndexing }

const CLEANUP_CRON = '0 4 * * *'

type CronController = { cron: string }

export default {
  async scheduled(controller: CronController, env: Record<string, unknown>): Promise<void> {
    if (controller.cron !== CLEANUP_CRON) return
    await pipelineStorage.run(pipelineContext(env), () => deleteStaleIndexes(Date.now()))
  },
}

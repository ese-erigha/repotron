import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

import { pipelineContext, pipelineStorage } from '../context.ts'
import { deleteNextPage } from './delete-page.ts'
import { deleteIndexRow, markDeleting } from '../repository-indexing/index-status.ts'

export type IndexDeletionParams = { indexId: string }

const STEP = { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' } } as const

export class IndexDeletion extends WorkflowEntrypoint<Record<string, unknown>, IndexDeletionParams> {
  async run(event: WorkflowEvent<IndexDeletionParams>, step: WorkflowStep): Promise<void> {
    const context = pipelineContext(this.env)
    const indexId = event.payload.indexId
    await step.do('mark deleting', STEP, () => pipelineStorage.run(context, () => markDeleting(indexId)))
    await deletePages(step, context, indexId)
    await step.do('delete the index row', STEP, () => pipelineStorage.run(context, () => deleteIndexRow(indexId)))
  }
}

async function deletePages(
  step: WorkflowStep,
  context: ReturnType<typeof pipelineContext>,
  indexId: string,
): Promise<void> {
  let page = 0
  let deleted = true
  while (deleted) {
    const current = page
    deleted = await step.do(`delete page ${current}`, STEP, () =>
      pipelineStorage.run(context, () => deleteNextPage(indexId)),
    )
    page += 1
  }
}

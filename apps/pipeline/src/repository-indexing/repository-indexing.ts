import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { INDEX_STATUS, type IndexStatus } from 'repotron-domain'

import { pipelineContext, pipelineStorage } from '../context.ts'
import { parseOnContainer, stopContainer, type ParseResult } from '../indexer-container/indexer-client.ts'
import {
  deleteBatches,
  deleteEarlierIndexes,
  failureReason,
  markEmbedding,
  markFailed,
  markParsing,
  markReady,
} from './index-status.ts'
import { storeBatch } from './store-batch.ts'
import { assertVectorsReady } from './wait-for-vectors.ts'

export type RepositoryIndexingParams = {
  indexId: string
  owner: string
  name: string
  commitSha: string
}

const STEP = { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' } } as const
const WAIT = { retries: { limit: 60, delay: '5 seconds', backoff: 'constant' } } as const

export class RepositoryIndexing extends WorkflowEntrypoint<Record<string, unknown>, RepositoryIndexingParams> {
  async run(event: WorkflowEvent<RepositoryIndexingParams>, step: WorkflowStep): Promise<void> {
    const context = pipelineContext(this.env)
    const params = event.payload
    let stage: IndexStatus = INDEX_STATUS.queued
    let batchKeys: string[] = []
    try {
      stage = INDEX_STATUS.parsing
      await step.do('mark parsing', STEP, () => pipelineStorage.run(context, () => markParsing(params.indexId)))
      const parsed = await step.do('parse the repository', STEP, () =>
        pipelineStorage.run(context, () => parseOnContainer(params)),
      )
      batchKeys = parsed.batchKeys
      await step.do('stop the container', STEP, () => pipelineStorage.run(context, () => stopContainer(params.indexId)))
      stage = INDEX_STATUS.embedding
      await step.do('mark embedding', STEP, () =>
        pipelineStorage.run(context, () => markEmbedding(params.indexId, parsed.fileCount)),
      )
      const lastUpsertAt = await storeEveryBatch(step, context, params.indexId, parsed)
      await step.do('wait for the vectors', WAIT, () =>
        pipelineStorage.run(context, () => assertVectorsReady(lastUpsertAt)),
      )
      await step.do('mark ready', STEP, () =>
        pipelineStorage.run(context, () => markReady(params.indexId, parsed.chunkCount)),
      )
      await step.do('delete the batches', STEP, () => pipelineStorage.run(context, () => deleteBatches(batchKeys)))
      await step.do('delete earlier indexes', STEP, () =>
        pipelineStorage.run(context, () => deleteEarlierIndexes(params.indexId)),
      )
    } catch (error) {
      await failIndexing(step, context, params.indexId, stage, failureReason(error, stage), batchKeys)
    }
  }
}

async function storeEveryBatch(
  step: WorkflowStep,
  context: ReturnType<typeof pipelineContext>,
  indexId: string,
  parsed: ParseResult,
): Promise<string> {
  let lastUpsertAt = new Date(0).toISOString()
  for (const [number, key] of parsed.batchKeys.entries()) {
    lastUpsertAt = await step.do(`store batch ${number}`, STEP, () =>
      pipelineStorage.run(context, () => storeBatch(indexId, key)),
    )
  }
  return lastUpsertAt
}

async function failIndexing(
  step: WorkflowStep,
  context: ReturnType<typeof pipelineContext>,
  indexId: string,
  stage: IndexStatus,
  reason: string,
  batchKeys: string[],
): Promise<void> {
  await step.do('mark failed', STEP, () => pipelineStorage.run(context, () => markFailed(indexId, stage, reason)))
  await step.do('stop the container after failure', STEP, () =>
    pipelineStorage.run(context, () => stopContainer(indexId)),
  )
  await step.do('delete the batches after failure', STEP, () =>
    pipelineStorage.run(context, () => deleteBatches(batchKeys)),
  )
}

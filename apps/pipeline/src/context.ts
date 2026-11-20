import { AsyncLocalStorage } from 'node:async_hooks'
import { createDatabase, RepotronRepositories } from 'db'

import type { BatchBucket, IndexerNamespace, VectorIndex, WorkflowClient } from './bindings.ts'
import { readPipelineEnv, type PipelineEnv } from './env.ts'

export type PipelineContext = {
  config: PipelineEnv
  repositories: RepotronRepositories
  vectors: VectorIndex
  batches: BatchBucket
  indexer: IndexerNamespace
  indexDeletion: WorkflowClient
}

export const pipelineStorage = new AsyncLocalStorage<PipelineContext>()

export function pipelineContext(source: Record<string, unknown>): PipelineContext {
  return {
    config: readPipelineEnv(source),
    repositories: new RepotronRepositories(createDatabase(source.DB as Parameters<typeof createDatabase>[0])),
    vectors: source.CHUNK_VECTORS as VectorIndex,
    batches: source.CHUNK_BATCHES as BatchBucket,
    indexer: source.INDEXER as IndexerNamespace,
    indexDeletion: source.INDEX_DELETION as WorkflowClient,
  }
}

export function getPipelineConfig(): PipelineEnv {
  return context().config
}

export function getRepositories(): RepotronRepositories {
  return context().repositories
}

export function getVectors(): VectorIndex {
  return context().vectors
}

export function getBatches(): BatchBucket {
  return context().batches
}

export function getIndexer(): IndexerNamespace {
  return context().indexer
}

export function getIndexDeletion(): WorkflowClient {
  return context().indexDeletion
}

function context(): PipelineContext {
  const current = pipelineStorage.getStore()
  if (!current) throw new Error('Pipeline config is not set.')
  return current
}

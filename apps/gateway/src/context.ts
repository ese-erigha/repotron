import { AsyncLocalStorage } from 'node:async_hooks'
import { createDatabase, RepotronRepositories } from 'db'
import type { RateLimitKind } from 'repotron-domain'

import type { RateLimitDecision } from './rate-limit.ts'
import { readGatewayEnv, type GatewayEnv } from './env.ts'

export type WorkflowStart = {
  id: string
  params: { indexId: string; owner: string; name: string; commitSha: string }
}

export type RepositoryIndexingClient = {
  create(instance: WorkflowStart): Promise<unknown>
  get(id: string): { restart(): Promise<void> }
}

export type VectorIndex = {
  query(
    vector: number[],
    options: { topK: number; namespace: string; returnValues: false; returnMetadata: 'none' },
  ): Promise<{ matches?: { id: string }[] }>
}

export type AiBinding = {
  run(
    model: string,
    input: { input: string[] },
    options: { gateway: { id: string } },
  ): Promise<{ data?: { embedding?: number[] }[] }>
}

type RateLimiterStub = { consume(kind: RateLimitKind): Promise<RateLimitDecision> }

export type GatewayContext = {
  config: GatewayEnv
  repositories: RepotronRepositories
  vectors: VectorIndex
  ai: AiBinding
  repositoryIndexing: RepositoryIndexingClient
  rateLimiter: { getByName(name: string): RateLimiterStub }
  execution: { waitUntil(promise: Promise<unknown>): void }
}

export const gatewayStorage = new AsyncLocalStorage<GatewayContext>()

export function gatewayContext(source: Record<string, unknown>, execution: GatewayContext['execution']): GatewayContext {
  return {
    config: readGatewayEnv(source),
    repositories: new RepotronRepositories(createDatabase(source.DB as Parameters<typeof createDatabase>[0])),
    vectors: source.CHUNK_VECTORS as VectorIndex,
    ai: source.AI as AiBinding,
    repositoryIndexing: source.REPOSITORY_INDEXING as RepositoryIndexingClient,
    rateLimiter: source.RATE_LIMITER as GatewayContext['rateLimiter'],
    execution,
  }
}

export function getConfig(): GatewayEnv {
  return context().config
}

export function getRepositories(): RepotronRepositories {
  return context().repositories
}

export function getVectors(): VectorIndex {
  return context().vectors
}

export function getAi(): AiBinding {
  return context().ai
}

export function getRepositoryIndexing(): RepositoryIndexingClient {
  return context().repositoryIndexing
}

export function getRateLimiter(): GatewayContext['rateLimiter'] {
  return context().rateLimiter
}

export function waitUntil(promise: Promise<unknown>): void {
  context().execution.waitUntil(promise)
}

function context(): GatewayContext {
  const current = gatewayStorage.getStore()
  if (!current) throw new Error('Gateway config is not set.')
  return current
}

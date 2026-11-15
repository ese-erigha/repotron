import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { INDEX_STATUS } from 'repotron-domain'

import type { RepotronDatabase } from '../create-database.ts'
import { repositoryIndexes, type NewRepositoryIndexRecord, type RepositoryIndexRecord } from '../schema/repository-indexes.ts'

export type InsertQueuedIndexInput = {
  id: string
  repositoryId: string
  commitSha: string
  embeddingModelId: string
  now: number
}

export type MarkEmbeddingInput = { id: string; fileCount: number; now: number }
export type MarkReadyInput = { id: string; chunkCount: number; now: number }
export type MarkFailedInput = { id: string; failedStage: string; failureReason: string; now: number }
export type FindNewestReadyInput = { repositoryId: string; excludeId: string }
export type ListEarlierIndexesInput = { repositoryId: string; createdAt: number }
export type ListStaleIndexesInput = { olderThan: number }

export class RepositoryIndexRepository {
  private readonly database: RepotronDatabase

  constructor(database: RepotronDatabase) {
    this.database = database
  }

  async get(id: string): Promise<RepositoryIndexRecord | undefined> {
    const rows = await this.database.select().from(repositoryIndexes).where(eq(repositoryIndexes.id, id)).limit(1)
    return rows[0]
  }

  async insertQueued(input: InsertQueuedIndexInput): Promise<void> {
    const row: NewRepositoryIndexRecord = {
      id: input.id,
      repositoryId: input.repositoryId,
      commitSha: input.commitSha,
      status: INDEX_STATUS.queued,
      embeddingModelId: input.embeddingModelId,
      createdAt: input.now,
      updatedAt: input.now,
    }
    await this.database.insert(repositoryIndexes).values(row)
  }

  async resetToQueued(input: { id: string; now: number }): Promise<void> {
    const changes = {
      status: INDEX_STATUS.queued,
      failedStage: null,
      failureReason: null,
      updatedAt: input.now,
    }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async markParsing(input: { id: string; now: number }): Promise<void> {
    const changes = { status: INDEX_STATUS.parsing, updatedAt: input.now }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async markEmbedding(input: MarkEmbeddingInput): Promise<void> {
    const changes = { status: INDEX_STATUS.embedding, fileCount: input.fileCount, updatedAt: input.now }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async markReady(input: MarkReadyInput): Promise<void> {
    const changes = {
      status: INDEX_STATUS.ready,
      chunkCount: input.chunkCount,
      readyAt: input.now,
      updatedAt: input.now,
    }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async markFailed(input: MarkFailedInput): Promise<void> {
    const changes = {
      status: INDEX_STATUS.failed,
      failedStage: input.failedStage,
      failureReason: input.failureReason,
      updatedAt: input.now,
    }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async markDeleting(input: { id: string; now: number }): Promise<void> {
    const changes = { status: INDEX_STATUS.deleting, updatedAt: input.now }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async recordQuestion(input: { id: string; at: number }): Promise<void> {
    const changes = { lastQuestionAt: input.at, updatedAt: input.at }
    await this.database.update(repositoryIndexes).set(changes).where(eq(repositoryIndexes.id, input.id))
  }

  async listRecentReady(limit: number): Promise<RepositoryIndexRecord[]> {
    return this.database
      .select()
      .from(repositoryIndexes)
      .where(eq(repositoryIndexes.status, INDEX_STATUS.ready))
      .orderBy(desc(repositoryIndexes.readyAt))
      .limit(limit)
  }

  async findNewestReady(input: FindNewestReadyInput): Promise<RepositoryIndexRecord | undefined> {
    const rows = await this.database
      .select()
      .from(repositoryIndexes)
      .where(
        and(
          eq(repositoryIndexes.repositoryId, input.repositoryId),
          eq(repositoryIndexes.status, INDEX_STATUS.ready),
          sql`${repositoryIndexes.id} <> ${input.excludeId}`,
        ),
      )
      .orderBy(desc(repositoryIndexes.readyAt))
      .limit(1)
    return rows[0]
  }

  async listEarlier(input: ListEarlierIndexesInput): Promise<RepositoryIndexRecord[]> {
    return this.database
      .select()
      .from(repositoryIndexes)
      .where(and(eq(repositoryIndexes.repositoryId, input.repositoryId), lt(repositoryIndexes.createdAt, input.createdAt)))
      .orderBy(asc(repositoryIndexes.createdAt))
  }

  async listStale(input: ListStaleIndexesInput): Promise<RepositoryIndexRecord[]> {
    const finished = inArray(repositoryIndexes.status, [INDEX_STATUS.ready, INDEX_STATUS.failed])
    const old = sql`coalesce(${repositoryIndexes.lastQuestionAt}, ${repositoryIndexes.readyAt}, ${repositoryIndexes.createdAt}) < ${input.olderThan}`
    return this.database.select().from(repositoryIndexes).where(and(finished, old))
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(repositoryIndexes).where(eq(repositoryIndexes.id, id))
  }
}

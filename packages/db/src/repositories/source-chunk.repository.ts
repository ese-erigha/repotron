import { and, asc, count, eq, inArray, lte } from 'drizzle-orm'

import type { RepotronDatabase } from '../create-database.ts'
import { sourceChunks, type NewSourceChunkRecord, type SourceChunkRecord } from '../schema/source-chunks.ts'

export type ListChunksByIdInput = { indexId: string; ids: string[] }
export type ListChunkIdPageInput = { indexId: string; limit: number }
export type DeleteChunksThroughInput = { indexId: string; lastId: string }
export type ListChunkPathsInput = { indexId: string; limit: number }

export class SourceChunkRepository {
  private readonly database: RepotronDatabase

  constructor(database: RepotronDatabase) {
    this.database = database
  }

  async insertBatch(rows: NewSourceChunkRecord[]): Promise<void> {
    const statements = rows.map((row) =>
      this.database.insert(sourceChunks).values(row).onConflictDoNothing(),
    )
    const [first, ...rest] = statements
    if (!first) return
    await this.database.batch([first, ...rest])
  }

  async countByIndex(indexId: string): Promise<number> {
    const rows = await this.database
      .select({ total: count() })
      .from(sourceChunks)
      .where(eq(sourceChunks.indexId, indexId))
    return rows[0]?.total ?? 0
  }

  async listByIds(input: ListChunksByIdInput): Promise<SourceChunkRecord[]> {
    if (input.ids.length === 0) return []
    return this.database
      .select()
      .from(sourceChunks)
      .where(and(eq(sourceChunks.indexId, input.indexId), inArray(sourceChunks.id, input.ids)))
  }

  async listIdPage(input: ListChunkIdPageInput): Promise<string[]> {
    const rows = await this.database
      .select({ id: sourceChunks.id })
      .from(sourceChunks)
      .where(eq(sourceChunks.indexId, input.indexId))
      .orderBy(asc(sourceChunks.id))
      .limit(input.limit)
    return rows.map((row) => row.id)
  }

  async deleteThrough(input: DeleteChunksThroughInput): Promise<void> {
    const match = and(eq(sourceChunks.indexId, input.indexId), lte(sourceChunks.id, input.lastId))
    await this.database.delete(sourceChunks).where(match)
  }

  async listPaths(input: ListChunkPathsInput): Promise<string[]> {
    const rows = await this.database
      .selectDistinct({ path: sourceChunks.path })
      .from(sourceChunks)
      .where(eq(sourceChunks.indexId, input.indexId))
      .orderBy(asc(sourceChunks.path))
      .limit(input.limit)
    return rows.map((row) => row.path)
  }
}

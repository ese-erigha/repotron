import { and, asc, count, eq, inArray, lte } from 'drizzle-orm'

import type { RepotronDatabase } from '../create-database.ts'
import { sourceChunks, type NewSourceChunkRecord, type SourceChunkRecord } from '../schema/source-chunks.ts'

export type ListChunksByIdInput = { indexId: string; ids: string[] }
export type ListChunkIdPageInput = { indexId: string; limit: number }
export type DeleteChunksThroughInput = { indexId: string; lastId: string }
export type ListChunkPathsInput = { indexId: string; limit: number }
export type ListChunksByKeywordInput = { indexId: string; match: string; limit: number }
export type ListSymbolChunksInput = { indexId: string; match: string; limit: number }

export type SymbolChunkRow = {
  path: string
  symbol: string | null
  startLine: number
  endLine: number
}

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

  async listIdsByKeyword(input: ListChunksByKeywordInput): Promise<string[]> {
    const result = await this.database.$client
      .prepare(
        `SELECT chunk_id AS chunkId
         FROM chunk_keywords
         WHERE chunk_keywords MATCH ?1 AND index_id = ?2
         ORDER BY rank
         LIMIT ?3`,
      )
      .bind(input.match, input.indexId, input.limit)
      .all()
    const rows = result.results as { chunkId: string }[]
    return rows.map((row) => row.chunkId)
  }

  async listBySymbol(input: ListSymbolChunksInput): Promise<SymbolChunkRow[]> {
    const result = await this.database.$client
      .prepare(
        `SELECT source_chunks.path AS path,
                source_chunks.symbol AS symbol,
                source_chunks.start_line AS startLine,
                source_chunks.end_line AS endLine
         FROM chunk_keywords
         JOIN source_chunks ON source_chunks.id = chunk_keywords.chunk_id
         WHERE chunk_keywords MATCH ?1 AND chunk_keywords.index_id = ?2
         ORDER BY rank
         LIMIT ?3`,
      )
      .bind(input.match, input.indexId, input.limit)
      .all()
    return result.results as SymbolChunkRow[]
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

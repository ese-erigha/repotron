import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Migration 0003 creates this as an FTS5 table. chunk_id and index_id are UNINDEXED.
export const chunkKeywords = sqliteTable('chunk_keywords', {
  chunkId: text('chunk_id').notNull(),
  indexId: text('index_id').notNull(),
  content: text('content').notNull(),
  identifiers: text('identifiers').notNull(),
})

export type ChunkKeywordRecord = typeof chunkKeywords.$inferSelect

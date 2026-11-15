import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { repositoryIndexes } from './repository-indexes.ts'

export const sourceChunks = sqliteTable(
  'source_chunks',
  {
    id: text('id').primaryKey().notNull(),
    indexId: text('index_id')
      .notNull()
      .references(() => repositoryIndexes.id),
    seq: integer('seq').notNull(),
    path: text('path').notNull(),
    language: text('language').notNull(),
    symbol: text('symbol'),
    kind: text('kind').notNull(),
    startLine: integer('start_line').notNull(),
    endLine: integer('end_line').notNull(),
    content: text('content').notNull(),
    identifiers: text('identifiers').notNull(),
  },
  (table) => [index('source_chunks_index_path').on(table.indexId, table.path)],
)

export type SourceChunkRecord = typeof sourceChunks.$inferSelect
export type NewSourceChunkRecord = typeof sourceChunks.$inferInsert

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { githubRepositories } from './github-repositories.ts'

export const repositoryIndexes = sqliteTable(
  'repository_indexes',
  {
    id: text('id').primaryKey().notNull(),
    repositoryId: text('repository_id')
      .notNull()
      .references(() => githubRepositories.id),
    commitSha: text('commit_sha').notNull(),
    status: text('status').notNull(),
    failedStage: text('failed_stage'),
    failureReason: text('failure_reason'),
    fileCount: integer('file_count'),
    chunkCount: integer('chunk_count'),
    chunkTotal: integer('chunk_total'),
    embeddingModelId: text('embedding_model_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    readyAt: integer('ready_at'),
    lastQuestionAt: integer('last_question_at'),
  },
  (table) => [index('repository_indexes_repository_created').on(table.repositoryId, table.createdAt)],
)

export type RepositoryIndexRecord = typeof repositoryIndexes.$inferSelect
export type NewRepositoryIndexRecord = typeof repositoryIndexes.$inferInsert

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const answeredQuestions = sqliteTable('answered_questions', {
  id: text('id').primaryKey().notNull(),
  indexId: text('index_id').notNull(),
  repositoryFullName: text('repository_full_name').notNull(),
  commitSha: text('commit_sha').notNull(),
  preset: text('preset'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  citations: text('citations').notNull(),
  embeddingModelId: text('embedding_model_id').notNull(),
  answerModelId: text('answer_model_id').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  retrievalMs: integer('retrieval_ms').notNull(),
  firstTokenMs: integer('first_token_ms'),
  answerMs: integer('answer_ms').notNull(),
  createdAt: integer('created_at').notNull(),
})

export type AnsweredQuestionRecord = typeof answeredQuestions.$inferSelect
export type NewAnsweredQuestionRecord = typeof answeredQuestions.$inferInsert

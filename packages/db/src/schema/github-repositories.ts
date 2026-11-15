import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const githubRepositories = sqliteTable('github_repositories', {
  id: text('id').primaryKey().notNull(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  defaultBranch: text('default_branch').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export type GithubRepositoryRecord = typeof githubRepositories.$inferSelect
export type NewGithubRepositoryRecord = typeof githubRepositories.$inferInsert

import { eq, inArray } from 'drizzle-orm'

import type { RepotronDatabase } from '../create-database.ts'
import {
  githubRepositories,
  type NewGithubRepositoryRecord,
} from '../schema/github-repositories.ts'

export type UpsertGithubRepositoryInput = {
  id: string
  owner: string
  name: string
  defaultBranch: string
  now: number
}

export class GithubRepositoryRepository {
  private readonly database: RepotronDatabase

  constructor(database: RepotronDatabase) {
    this.database = database
  }

  async upsert(input: UpsertGithubRepositoryInput): Promise<void> {
    const row: NewGithubRepositoryRecord = {
      id: input.id,
      owner: input.owner,
      name: input.name,
      defaultBranch: input.defaultBranch,
      createdAt: input.now,
      updatedAt: input.now,
    }
    const changes = {
      owner: input.owner,
      name: input.name,
      defaultBranch: input.defaultBranch,
      updatedAt: input.now,
    }
    await this.database
      .insert(githubRepositories)
      .values(row)
      .onConflictDoUpdate({ target: githubRepositories.id, set: changes })
  }

  async listByIds(ids: string[]) {
    if (ids.length === 0) return []
    return this.database.select().from(githubRepositories).where(inArray(githubRepositories.id, ids))
  }

  async get(id: string) {
    const rows = await this.database
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.id, id))
      .limit(1)
    return rows[0]
  }
}

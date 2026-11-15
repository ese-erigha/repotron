import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { EMBEDDING_MODEL_ID } from 'repotron-domain'

import type { RepotronDatabase } from './create-database.ts'
import { RepotronRepositories } from './repositories/index.ts'
import * as schema from './schema/index.ts'
import type { NewSourceChunkRecord } from './schema/source-chunks.ts'

const DAY_MS = 24 * 60 * 60 * 1000

function openRepositories(): RepotronRepositories {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(readFileSync(new URL('../../../infra/migrations/0000_phase1_initial.sql', import.meta.url), 'utf8'))
  const database = drizzle(sqlite, { schema })
  const batchDatabase = Object.assign(database, {
    async batch(statements: readonly PromiseLike<unknown>[]): Promise<void> {
      for (const statement of statements) await statement
    },
  })
  return new RepotronRepositories(batchDatabase as unknown as RepotronDatabase)
}

function chunk(id: string, seq: number): NewSourceChunkRecord {
  return {
    id,
    indexId: '9-abc',
    seq,
    path: 'src/app.py',
    language: 'python',
    symbol: 'main',
    kind: 'function',
    startLine: 1,
    endLine: 3,
    content: 'def main():\n    return 1\n',
    identifiers: 'main',
  }
}

describe('repositories', () => {
  it('when a repository is indexed again after a rename, then the id stays and the name changes', async () => {
    const repositories = openRepositories()
    await repositories.githubRepositories.upsert({
      id: '9',
      owner: 'owner',
      name: 'old',
      defaultBranch: 'main',
      now: 1,
    })
    await repositories.githubRepositories.upsert({
      id: '9',
      owner: 'owner',
      name: 'new',
      defaultBranch: 'main',
      now: 2,
    })
    const row = await repositories.githubRepositories.get('9')
    assert.equal(row?.name, 'new')
    assert.equal(row?.createdAt, 1)
  })

  it('when a batch is stored twice, then the second store writes no second chunk row', async () => {
    const repositories = openRepositories()
    await repositories.githubRepositories.upsert({
      id: '9',
      owner: 'owner',
      name: 'repo',
      defaultBranch: 'main',
      now: 1,
    })
    await repositories.repositoryIndexes.insertQueued({
      id: '9-abc',
      repositoryId: '9',
      commitSha: 'abc',
      embeddingModelId: EMBEDDING_MODEL_ID,
      now: 1,
    })
    await repositories.sourceChunks.insertBatch([chunk('9-abc:0', 0)])
    await repositories.sourceChunks.insertBatch([chunk('9-abc:0', 0)])
    const ids = await repositories.sourceChunks.listIdPage({ indexId: '9-abc', limit: 10 })
    assert.deepEqual(ids, ['9-abc:0'])
  })

  it('when a page of chunks is deleted, then a later chunk remains', async () => {
    const repositories = openRepositories()
    await repositories.githubRepositories.upsert({
      id: '9',
      owner: 'owner',
      name: 'repo',
      defaultBranch: 'main',
      now: 1,
    })
    await repositories.repositoryIndexes.insertQueued({
      id: '9-abc',
      repositoryId: '9',
      commitSha: 'abc',
      embeddingModelId: EMBEDDING_MODEL_ID,
      now: 1,
    })
    await repositories.sourceChunks.insertBatch([chunk('9-abc:0', 0), chunk('9-abc:1', 1)])
    await repositories.sourceChunks.deleteThrough({ indexId: '9-abc', lastId: '9-abc:0' })
    const ids = await repositories.sourceChunks.listIdPage({ indexId: '9-abc', limit: 10 })
    assert.deepEqual(ids, ['9-abc:1'])
  })

  it('when an index was asked about inside the retention window, then the stale list omits it', async () => {
    const repositories = openRepositories()
    const now = 40 * DAY_MS
    await repositories.githubRepositories.upsert({
      id: '9',
      owner: 'owner',
      name: 'repo',
      defaultBranch: 'main',
      now: 1,
    })
    await repositories.repositoryIndexes.insertQueued({
      id: '9-abc',
      repositoryId: '9',
      commitSha: 'abc',
      embeddingModelId: EMBEDDING_MODEL_ID,
      now: 1,
    })
    await repositories.repositoryIndexes.markReady({ id: '9-abc', chunkCount: 1, now: 2 })
    await repositories.repositoryIndexes.recordQuestion({ id: '9-abc', at: now - DAY_MS })
    const stale = await repositories.repositoryIndexes.listStale({ olderThan: now - 30 * DAY_MS })
    assert.deepEqual(stale, [])
  })

  it('when an index has no question for 30 days, then the stale list includes it', async () => {
    const repositories = openRepositories()
    const now = 40 * DAY_MS
    await repositories.githubRepositories.upsert({
      id: '9',
      owner: 'owner',
      name: 'repo',
      defaultBranch: 'main',
      now: 1,
    })
    await repositories.repositoryIndexes.insertQueued({
      id: '9-abc',
      repositoryId: '9',
      commitSha: 'abc',
      embeddingModelId: EMBEDDING_MODEL_ID,
      now: 1,
    })
    await repositories.repositoryIndexes.markReady({ id: '9-abc', chunkCount: 1, now: 2 })
    const stale = await repositories.repositoryIndexes.listStale({ olderThan: now - 30 * DAY_MS })
    assert.deepEqual(stale.map((row) => row.id), ['9-abc'])
  })
})

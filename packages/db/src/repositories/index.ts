import type { RepotronDatabase } from '../create-database.ts'
import { AnsweredQuestionRepository } from './answered-question.repository.ts'
import { GithubRepositoryRepository } from './github-repository.repository.ts'
import { RepositoryIndexRepository } from './repository-index.repository.ts'
import { SourceChunkRepository } from './source-chunk.repository.ts'

export class RepotronRepositories {
  readonly githubRepositories: GithubRepositoryRepository
  readonly repositoryIndexes: RepositoryIndexRepository
  readonly sourceChunks: SourceChunkRepository
  readonly answeredQuestions: AnsweredQuestionRepository

  constructor(database: RepotronDatabase) {
    this.githubRepositories = new GithubRepositoryRepository(database)
    this.repositoryIndexes = new RepositoryIndexRepository(database)
    this.sourceChunks = new SourceChunkRepository(database)
    this.answeredQuestions = new AnsweredQuestionRepository(database)
  }
}

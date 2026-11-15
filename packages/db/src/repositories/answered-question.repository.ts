import { eq } from 'drizzle-orm'

import type { RepotronDatabase } from '../create-database.ts'
import { answeredQuestions, type AnsweredQuestionRecord, type NewAnsweredQuestionRecord } from '../schema/answered-questions.ts'

export class AnsweredQuestionRepository {
  private readonly database: RepotronDatabase

  constructor(database: RepotronDatabase) {
    this.database = database
  }

  async insert(row: NewAnsweredQuestionRecord): Promise<void> {
    await this.database.insert(answeredQuestions).values(row)
  }

  async get(id: string): Promise<AnsweredQuestionRecord | undefined> {
    const rows = await this.database.select().from(answeredQuestions).where(eq(answeredQuestions.id, id)).limit(1)
    return rows[0]
  }
}

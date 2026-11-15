import type { FixtureRepository } from './fixture-repository.ts'
import { FLASK_REPOSITORY } from './flask.fixture.ts'
import { buildGenericRepository } from './generic.fixture.ts'
import { HONO_REPOSITORY } from './hono.fixture.ts'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export type SeedIndex = {
  repository: FixtureRepository
  /** How long before the dev server started the index became ready. */
  readyAgoMs: number
}

/** The indexes that exist when the dev server starts. The home screen lists them. */
export const SEED_INDEXES: readonly SeedIndex[] = [
  { repository: HONO_REPOSITORY, readyAgoMs: 2 * HOUR_MS },
  { repository: FLASK_REPOSITORY, readyAgoMs: 26 * HOUR_MS },
  { repository: buildGenericRepository({ owner: 'tokio-rs', name: 'axum' }), readyAgoMs: 3 * DAY_MS },
  { repository: buildGenericRepository({ owner: 'gin-gonic', name: 'gin' }), readyAgoMs: 5 * DAY_MS },
  { repository: buildGenericRepository({ owner: 'expressjs', name: 'express' }), readyAgoMs: 9 * DAY_MS },
]

export type SeedQuestion = {
  id: string
  repository: FixtureRepository
  question: string
  askedAgoMs: number
}

/** Shared answers that exist when the dev server starts, so `/a/:id` works after a restart. */
export const SEED_QUESTIONS: readonly SeedQuestion[] = [
  {
    id: '7f3a9c2e41d84b0fa6c5e8d19b3f2a67',
    repository: HONO_REPOSITORY,
    question: 'Where is the router created?',
    askedAgoMs: 90 * 60_000,
  },
  {
    id: 'c41e8a7d2b9f4063a5d7e1f08b6c3d92',
    repository: FLASK_REPOSITORY,
    question: 'What happens between the WSGI call and the response?',
    askedAgoMs: 20 * HOUR_MS,
  },
]

import { ERROR_CODE, REPOSITORY_MAX_FILES, type ErrorCode } from 'repotron-domain'

export type FixtureError = {
  status: number
  code: ErrorCode
  message: string
  retryAfterSeconds?: number
}

/** A repository link with one of these names shows one state of the intake flow. */
export const LINK_SCENARIO = {
  private: 'fixtures/private',
  tooLarge: 'fixtures/too-large',
  tooManyFiles: 'fixtures/too-many-files',
  rateLimited: 'fixtures/rate-limited',
  githubDown: 'fixtures/github-down',
  turnstileFailed: 'fixtures/turnstile-failed',
  failsParsing: 'fixtures/fails-parsing',
  slow: 'fixtures/slow',
  newCommit: 'fixtures/new-commit',
} as const

/** The messages match the gateway, so the UI shows the production wording. */
export const FIXTURE_ERROR = {
  invalidRequest: { status: 400, code: ERROR_CODE.validationFailed, message: 'The request is invalid.' },
  invalidLink: { status: 400, code: ERROR_CODE.validationFailed, message: 'The repository link is invalid.' },
  missingRoute: { status: 404, code: ERROR_CODE.notFound, message: 'The resource was not found.' },
  missingIndex: { status: 404, code: ERROR_CODE.notFound, message: 'The index does not exist.' },
  missingAnswer: { status: 404, code: ERROR_CODE.notFound, message: 'This answer does not exist.' },
  indexNotReady: { status: 409, code: ERROR_CODE.indexNotReady, message: 'The index is not ready.' },
  rateLimited: {
    status: 429,
    code: ERROR_CODE.rateLimited,
    message: 'The hourly limit is reached.',
    retryAfterSeconds: 1_740,
  },
  internal: { status: 500, code: ERROR_CODE.internal, message: 'Something went wrong.' },
} as const satisfies Record<string, FixtureError>

export const LINK_ERROR: Record<string, FixtureError> = {
  [LINK_SCENARIO.private]: {
    status: 404,
    code: ERROR_CODE.repositoryNotFound,
    message: 'This repository does not exist or is private.',
  },
  [LINK_SCENARIO.tooLarge]: {
    status: 400,
    code: ERROR_CODE.repositoryTooLarge,
    message: 'The repository is larger than 500 MB.',
  },
  [LINK_SCENARIO.tooManyFiles]: {
    status: 400,
    code: ERROR_CODE.repositoryTooLarge,
    message: `The repository has more than ${REPOSITORY_MAX_FILES} files.`,
  },
  [LINK_SCENARIO.rateLimited]: FIXTURE_ERROR.rateLimited,
  [LINK_SCENARIO.githubDown]: {
    status: 503,
    code: ERROR_CODE.githubUnavailable,
    message: 'GitHub is unavailable.',
  },
  [LINK_SCENARIO.turnstileFailed]: {
    status: 403,
    code: ERROR_CODE.turnstileFailed,
    message: 'The Turnstile check failed.',
  },
}

/** A question with one of these texts shows one state of the answer stream. */
export const QUESTION_SCENARIO = {
  /** The model fails after the first part of the answer. */
  error: '/error',
  /** The hourly question limit is reached. */
  limit: '/limit',
  /** The connection drops before a response. */
  offline: '/offline',
  /** The repository does not hold the answer. */
  none: '/none',
  /** The retrieval and the first token arrive late. */
  slow: '/slow',
  /** The answer is 4 times as long. */
  long: '/long',
} as const

export const PARSING_FAILURE_REASON = 'The repository download timed out.'
export const MODEL_FAILURE_MESSAGE = 'The answer model failed.'

/** Wait times that make each loading state visible. */
export const FIXTURE_DELAY_MS = {
  read: 250,
  requestIndex: 700,
  retrieval: 450,
  firstToken: 650,
  token: 22,
  slowRetrieval: 3_000,
  slowFirstToken: 4_000,
} as const

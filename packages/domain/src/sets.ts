export const INDEX_STATUS = {
  queued: 'queued',
  parsing: 'parsing',
  embedding: 'embedding',
  ready: 'ready',
  failed: 'failed',
  deleting: 'deleting',
} as const

export type IndexStatus = (typeof INDEX_STATUS)[keyof typeof INDEX_STATUS]

export const CHUNK_KIND = {
  function: 'function',
  method: 'method',
  class: 'class',
  interface: 'interface',
  type: 'type',
  module: 'module',
  heading: 'heading',
  window: 'window',
} as const

export type ChunkKind = (typeof CHUNK_KIND)[keyof typeof CHUNK_KIND]

export const LANGUAGE = {
  python: 'python',
  typescript: 'typescript',
  javascript: 'javascript',
  go: 'go',
  java: 'java',
  rust: 'rust',
  markdown: 'markdown',
  text: 'text',
} as const

export type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE]

export const PRESET = {
  startHere: 'start_here',
  explainFeature: 'explain_feature',
} as const

export type Preset = (typeof PRESET)[keyof typeof PRESET]

export const ERROR_CODE = {
  validationFailed: 'validation_failed',
  repositoryTooLarge: 'repository_too_large',
  turnstileFailed: 'turnstile_failed',
  notFound: 'not_found',
  repositoryNotFound: 'repository_not_found',
  indexNotReady: 'index_not_ready',
  rateLimited: 'rate_limited',
  githubUnavailable: 'github_unavailable',
  internal: 'internal',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

export const STREAM_EVENT = {
  retrieval: 'retrieval',
  token: 'token',
  done: 'done',
  error: 'error',
} as const

export type StreamEventName = (typeof STREAM_EVENT)[keyof typeof STREAM_EVENT]

export const RATE_LIMIT_KIND = {
  index: 'index',
  question: 'question',
} as const

export type RateLimitKind = (typeof RATE_LIMIT_KIND)[keyof typeof RATE_LIMIT_KIND]

export const EMBEDDING_MODEL_ID = 'mongodb/voyage-code-4'
export const RERANK_MODEL_ID = 'mongodb/rerank-3'
export const EMBEDDING_INPUT = {
  query: 'query',
  document: 'document',
} as const
export type EmbeddingInput = (typeof EMBEDDING_INPUT)[keyof typeof EMBEDDING_INPUT]
export const ANSWER_MODEL_ID = 'anthropic/claude-haiku-5.5'

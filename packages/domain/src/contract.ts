import { z } from 'zod'

import {
  CHUNK_BATCH_SIZE,
  FILE_MAX_BYTES,
  LINE_OVERLAP,
  LINE_WINDOW,
  MAX_CHUNK_TOKENS,
} from './limits.ts'
import { chunkSchema } from './schemas.ts'

export const CONTRACT_LIMITS = {
  maxChunkTokens: MAX_CHUNK_TOKENS,
  lineWindow: LINE_WINDOW,
  lineOverlap: LINE_OVERLAP,
  chunkBatchSize: CHUNK_BATCH_SIZE,
  fileMaxBytes: FILE_MAX_BYTES,
} as const

export function buildContract(): string {
  const contract = {
    chunk: z.toJSONSchema(chunkSchema),
    limits: CONTRACT_LIMITS,
  }
  return `${JSON.stringify(contract, null, 2)}\n`
}

import { z } from 'zod'

import { CHUNK_KIND, ERROR_CODE, INDEX_STATUS, LANGUAGE, PRESET, SYMBOL_HIT_ROLE } from './sets.ts'

const values = <T extends Record<string, string>>(set: T) =>
  Object.values(set) as [T[keyof T], ...T[keyof T][]]

export const indexStatusSchema = z.enum(values(INDEX_STATUS))
export const chunkKindSchema = z.enum(values(CHUNK_KIND))
export const languageSchema = z.enum(values(LANGUAGE))
export const presetSchema = z.enum(values(PRESET))
export const errorCodeSchema = z.enum(values(ERROR_CODE))

export const chunkSchema = z.object({
  id: z.string().min(1),
  seq: z.number().int().nonnegative(),
  path: z.string().min(1),
  language: languageSchema,
  symbol: z.string().nullable(),
  kind: chunkKindSchema,
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  content: z.string(),
  header: z.string(),
  identifiers: z.string(),
})

export type Chunk = z.infer<typeof chunkSchema>

export const citationSchema = z.object({
  number: z.number().int().positive(),
  path: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  symbol: z.string().nullable(),
  kind: chunkKindSchema,
  content: z.string(),
  githubUrl: z.string().url(),
})

export type Citation = z.infer<typeof citationSchema>

export const symbolHitSchema = z.object({
  role: z.enum(values(SYMBOL_HIT_ROLE)),
  path: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  githubUrl: z.string().url(),
})

export const symbolTraceSchema = z.object({
  symbol: z.string(),
  hits: z.array(symbolHitSchema),
})

export type SymbolHit = z.infer<typeof symbolHitSchema>
export type SymbolTrace = z.infer<typeof symbolTraceSchema>

export const indexViewSchema = z.object({
  id: z.string(),
  repository: z.object({ owner: z.string(), name: z.string() }),
  commitSha: z.string(),
  status: indexStatusSchema,
  failedStage: indexStatusSchema.nullable(),
  failureReason: z.string().nullable(),
  fileCount: z.number().int().nullable(),
  chunkCount: z.number().int().nullable(),
  chunkTotal: z.number().int().nonnegative().nullable().default(null),
  fallbackIndexId: z.string().nullable(),
  createdAt: z.number().int(),
  readyAt: z.number().int().nullable(),
})

export type IndexView = z.infer<typeof indexViewSchema>

export const questionViewSchema = z.object({
  id: z.string(),
  repositoryFullName: z.string(),
  commitSha: z.string(),
  preset: presetSchema.nullable(),
  question: z.string(),
  answer: z.string(),
  citations: z.array(citationSchema),
  createdAt: z.number().int(),
})

export type QuestionView = z.infer<typeof questionViewSchema>

export const retrievalEventSchema = z.object({ citations: z.array(citationSchema) })
export const tokenEventSchema = z.object({ text: z.string() })
export const doneEventSchema = z.object({
  questionId: z.string(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  retrievalMs: z.number().int(),
  firstTokenMs: z.number().int().nullable(),
  answerMs: z.number().int(),
})
export const errorEventSchema = z.object({ code: errorCodeSchema, message: z.string() })

export type RetrievalEvent = z.infer<typeof retrievalEventSchema>
export type TokenEvent = z.infer<typeof tokenEventSchema>
export type DoneEvent = z.infer<typeof doneEventSchema>
export type ErrorEvent = z.infer<typeof errorEventSchema>

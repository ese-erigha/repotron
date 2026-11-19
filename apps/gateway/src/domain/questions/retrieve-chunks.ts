import {
  CONTEXT_CHUNKS,
  EMBEDDING_MODEL_ID,
  formatQueryInput,
  keywordMatch,
  promoteSymbolHit,
} from 'repotron-domain'
import type { SourceChunkRecord } from 'db'

import { getAi, getConfig, getRepositories, getVectors } from '../../context.ts'

export type SearchInput = {
  indexId: string
  question: string
  limit: number
}

export async function semanticSearch(input: SearchInput): Promise<SourceChunkRecord[]> {
  const ids = await vectorIds(input.indexId, input.question, input.limit)
  return rowsInOrder(input.indexId, ids)
}

export async function keywordSearch(input: SearchInput): Promise<SourceChunkRecord[]> {
  const ids = await keywordIds(input)
  return rowsInOrder(input.indexId, ids)
}

export async function retrieveAnswerChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const search: SearchInput = { indexId, question, limit: CONTEXT_CHUNKS }
  const chunks = await semanticSearch(search)
  return promoteSymbolHit(chunks, question)
}

async function vectorIds(indexId: string, question: string, topK: number): Promise<string[]> {
  const embedded = await getAi().run(
    EMBEDDING_MODEL_ID,
    { input: [formatQueryInput(question)] },
    { gateway: { id: getConfig().AI_GATEWAY_ID } },
  )
  const vector = embedded.data?.[0]?.embedding
  if (!vector) throw new Error(`The question embedding is missing. The model returned ${embedded.data?.length ?? 0} rows.`)
  const result = await getVectors().query(vector, {
    topK,
    namespace: indexId,
    returnValues: false,
    returnMetadata: 'none',
  })
  return (result.matches ?? []).map((match) => match.id)
}

async function keywordIds(input: SearchInput): Promise<string[]> {
  const match = keywordMatch(input.question)
  if (match === '') return []
  return getRepositories().sourceChunks.listIdsByKeyword({
    indexId: input.indexId,
    match,
    limit: input.limit,
  })
}

async function rowsInOrder(indexId: string, ids: string[]): Promise<SourceChunkRecord[]> {
  const rows = await getRepositories().sourceChunks.listByIds({ indexId, ids })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

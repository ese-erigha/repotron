import {
  CONTEXT_CHUNKS,
  EMBEDDING_MODEL_ID,
  formatQueryInput,
  keywordMatch,
  promoteSymbolHit,
  RETRIEVAL_TOP_K,
} from 'repotron-domain'
import type { SourceChunkRecord } from 'db'

import { getAi, getConfig, getRepositories, getVectors } from '../../context.ts'

export async function retrieveChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const ids = await vectorIds(indexId, question, CONTEXT_CHUNKS)
  return rowsInOrder(indexId, ids)
}

export async function retrieveKeywordChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const ids = await keywordIds(indexId, question)
  return rowsInOrder(indexId, ids)
}

export async function retrieveHybridChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const chunks = await retrieveChunks(indexId, question)
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

async function keywordIds(indexId: string, question: string): Promise<string[]> {
  const match = keywordMatch(question)
  if (match === '') return []
  return getRepositories().sourceChunks.listIdsByKeyword({
    indexId,
    match,
    limit: RETRIEVAL_TOP_K,
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

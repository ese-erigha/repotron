import { CONTEXT_CHUNKS, EMBEDDING_MODEL_ID, formatQueryInput, keywordMatch, RETRIEVAL_TOP_K } from 'repotron-domain'
import type { SourceChunkRecord } from 'db'

import { getAi, getConfig, getRepositories, getVectors } from '../../context.ts'

export async function retrieveChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const embedded = await getAi().run(
    EMBEDDING_MODEL_ID,
    { input: [formatQueryInput(question)] },
    { gateway: { id: getConfig().AI_GATEWAY_ID } },
  )
  const vector = embedded.data?.[0]?.embedding
  if (!vector) throw new Error(`The question embedding is missing. The model returned ${embedded.data?.length ?? 0} rows.`)
  const result = await getVectors().query(vector, {
    topK: CONTEXT_CHUNKS,
    namespace: indexId,
    returnValues: false,
    returnMetadata: 'none',
  })
  return rowsInOrder(indexId, (result.matches ?? []).map((match) => match.id))
}

export async function retrieveKeywordChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const match = keywordMatch(question)
  if (match === '') return []
  const ids = await getRepositories().sourceChunks.listIdsByKeyword({
    indexId,
    match,
    limit: RETRIEVAL_TOP_K,
  })
  return rowsInOrder(indexId, ids)
}

async function rowsInOrder(indexId: string, ids: string[]): Promise<SourceChunkRecord[]> {
  const rows = await getRepositories().sourceChunks.listByIds({ indexId, ids })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

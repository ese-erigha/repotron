import { CONTEXT_CHUNKS, EMBEDDING_MODEL_ID, formatQueryInput } from 'repotron-domain'
import type { SourceChunkRecord } from 'db'

import { getAi, getConfig, getRepositories, getVectors } from '../../context.ts'

export async function retrieveChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const embedded = await getAi().run(
    EMBEDDING_MODEL_ID,
    { input: [formatQueryInput(question)] },
    { gateway: { id: getConfig().AI_GATEWAY_ID } },
  )
  const vector = embedded.data?.[0]?.embedding
  if (!vector) throw new Error('The question embedding is missing.')
  const result = await getVectors().query(vector, {
    topK: CONTEXT_CHUNKS,
    namespace: indexId,
    returnValues: false,
    returnMetadata: 'none',
  })
  const ids = (result.matches ?? []).map((match) => match.id)
  const rows = await getRepositories().sourceChunks.listByIds({ indexId, ids })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

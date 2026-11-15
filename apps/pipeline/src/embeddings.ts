import { EMBED_BATCH_SIZE, EMBEDDING_MODEL_ID } from 'repotron-domain'

import { getAi, getPipelineConfig } from './context.ts'

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = []
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
    const embedded = await embedBatch(batch)
    vectors.push(...embedded)
  }
  return vectors
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const result = await getAi().run(
    EMBEDDING_MODEL_ID,
    { text: texts },
    { gateway: { id: getPipelineConfig().AI_GATEWAY_ID } },
  )
  const rows = result.data ?? []
  if (rows.length !== texts.length) throw new Error('The embedding response has the wrong size.')
  return rows
}

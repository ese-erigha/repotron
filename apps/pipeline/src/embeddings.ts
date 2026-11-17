import { EMBED_BATCH_SIZE, EMBED_CONCURRENCY, EMBEDDING_MODEL_ID } from 'repotron-domain'

import { getAi, getPipelineConfig } from './context.ts'

export const EMBEDDING_WAVE_SIZE = EMBED_BATCH_SIZE * EMBED_CONCURRENCY

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = []
  for (let start = 0; start < texts.length; start += EMBEDDING_WAVE_SIZE) {
    const wave = texts.slice(start, start + EMBEDDING_WAVE_SIZE)
    const embedded = await embedWave(wave)
    vectors.push(...embedded)
  }
  return vectors
}

async function embedWave(texts: string[]): Promise<number[][]> {
  const calls: Promise<number[][]>[] = []
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
    calls.push(embedBatch(batch))
  }
  const embedded = await Promise.all(calls)
  const vectors: number[][] = []
  for (const batch of embedded) vectors.push(...batch)
  return vectors
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const result = await getAi().run(
    EMBEDDING_MODEL_ID,
    { input: texts },
    { gateway: { id: getPipelineConfig().AI_GATEWAY_ID } },
  )
  const rows = result.data ?? []
  if (rows.length !== texts.length) {
    throw new Error(`The embedding response has the wrong size. Expected ${texts.length} and received ${rows.length}.`)
  }
  return rows.map((row, index) => {
    if (!row.embedding) throw new Error(`An embedding is missing. Row ${index} of ${texts.length}.`)
    return row.embedding
  })
}

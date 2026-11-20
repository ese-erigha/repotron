import {
  EMBED_BATCH_SIZE,
  EMBED_CONCURRENCY,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_INPUT,
  EMBEDDING_MODEL_ID,
} from 'repotron-domain'

import { getPipelineConfig } from './context.ts'

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

type EmbeddingResponse = {
  data?: { embedding?: number[]; index?: number }[]
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const config = getPipelineConfig()
  const payload = {
    model: EMBEDDING_MODEL_ID,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
    input_type: EMBEDDING_INPUT.document,
  }
  const response = await fetch(embeddingUrl(config.CLOUDFLARE_ACCOUNT_ID, config.AI_GATEWAY_ID), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      'cf-aig-authorization': `Bearer ${config.CF_AIG_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`The embedding model failed with status ${response.status}. ${detail}`)
  }
  const body = (await response.json()) as EmbeddingResponse
  return readEmbeddings(body, texts.length)
}

function embeddingUrl(accountId: string, gatewayId: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openrouter/embeddings`
}

function readEmbeddings(body: EmbeddingResponse, expected: number): number[][] {
  const rows = [...(body.data ?? [])].sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
  if (rows.length !== expected) {
    throw new Error(`The embedding response has the wrong size. Expected ${expected} and received ${rows.length}.`)
  }
  return rows.map((row, index) => {
    if (!row.embedding) throw new Error(`An embedding is missing. Row ${index} of ${expected}.`)
    return row.embedding
  })
}

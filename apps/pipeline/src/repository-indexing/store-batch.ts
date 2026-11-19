import { chunkSchema, formatChunkInput, type Chunk } from 'repotron-domain'
import type { NewSourceChunkRecord } from 'db'

import { getBatches, getRepositories, getVectors } from '../context.ts'
import { EMBEDDING_WAVE_SIZE, embedTexts } from '../embeddings.ts'
import { recordChunkProgress } from './index-status.ts'

export async function storeBatch(indexId: string, key: string, chunkTotal: number): Promise<string> {
  const object = await getBatches().get(key)
  if (!object) throw new Error(`A chunk batch is missing. Key ${key}.`)
  const chunks = parseBatch(await object.text())
  let upsertedAt = new Date(0).toISOString()
  for (let start = 0; start < chunks.length; start += EMBEDDING_WAVE_SIZE) {
    const wave = chunks.slice(start, start + EMBEDDING_WAVE_SIZE)
    upsertedAt = await storeWave(indexId, wave, chunkTotal)
  }
  return upsertedAt
}

async function storeWave(indexId: string, chunks: Chunk[], chunkTotal: number): Promise<string> {
  const rows = chunks.map((chunk) => toChunkRow(indexId, chunk))
  const [, vectors] = await Promise.all([
    getRepositories().sourceChunks.insertBatch(rows),
    embedTexts(chunks.map((chunk) => formatChunkInput(chunk.header, chunk.content))),
  ])
  const upserts = chunks.map((chunk, index) => toVector(indexId, chunk, vectors[index]))
  // Vectorize stamps the mutation before this call returns. A later time stays ahead of that stamp.
  const upsertedAt = new Date().toISOString()
  await getVectors().upsert(upserts)
  await recordChunkProgress(indexId, chunkTotal)
  return upsertedAt
}

function parseBatch(text: string) {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => chunkSchema.parse(JSON.parse(line)))
}

function toChunkRow(indexId: string, chunk: ReturnType<typeof chunkSchema.parse>): NewSourceChunkRecord {
  return {
    id: chunk.id,
    indexId,
    seq: chunk.seq,
    path: chunk.path,
    language: chunk.language,
    symbol: chunk.symbol,
    kind: chunk.kind,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    content: chunk.content,
    identifiers: chunk.identifiers,
  }
}

function toVector(indexId: string, chunk: ReturnType<typeof chunkSchema.parse>, values: number[] | undefined) {
  if (!values) throw new Error(`An embedding is missing. Chunk ${chunk.id}.`)
  return {
    id: chunk.id,
    values,
    namespace: indexId,
    metadata: { path: chunk.path, language: chunk.language, kind: chunk.kind },
  }
}

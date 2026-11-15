import { chunkSchema, formatChunkInput } from 'repotron-domain'
import type { NewSourceChunkRecord } from 'db'

import { getBatches, getRepositories, getVectors } from '../context.ts'
import { embedTexts } from '../embeddings.ts'

export async function storeBatch(indexId: string, key: string): Promise<string> {
  const object = await getBatches().get(key)
  if (!object) throw new Error('A chunk batch is missing.')
  const chunks = parseBatch(await object.text())
  const rows = chunks.map((chunk) => toChunkRow(indexId, chunk))
  await getRepositories().sourceChunks.insertBatch(rows)
  const vectors = await embedTexts(chunks.map((chunk) => formatChunkInput(chunk.header, chunk.content)))
  const upserts = chunks.map((chunk, index) => toVector(indexId, chunk, vectors[index]))
  await getVectors().upsert(upserts)
  return new Date().toISOString()
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
  if (!values) throw new Error('An embedding is missing.')
  return {
    id: chunk.id,
    values,
    namespace: indexId,
    metadata: { path: chunk.path, language: chunk.language, kind: chunk.kind },
  }
}

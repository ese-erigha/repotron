import {
  CONTEXT_CHUNKS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_INPUT,
  EMBEDDING_MODEL_ID,
  formatQueryInput,
  keywordMatch,
  promoteSymbolHit,
  RERANK_MODEL_ID,
  RETRIEVAL_TOP_K,
} from 'repotron-domain'
import type { SourceChunkRecord } from 'db'

import { getConfig, getRepositories, getVectors } from '../../context.ts'

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

export async function retrieveHybridChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const semantic: SearchInput = { indexId, question, limit: CONTEXT_CHUNKS }
  const keywords: SearchInput = { indexId, question, limit: RETRIEVAL_TOP_K }
  const [semanticChunks, keywordChunks] = await Promise.all([
    semanticSearch(semantic),
    keywordSearch(keywords),
  ])
  const combined = appendKeywordChunk(semanticChunks, keywordChunks[0])
  return promoteSymbolHit(combined, question)
}

export async function retrieveAnswerChunks(indexId: string, question: string): Promise<SourceChunkRecord[]> {
  const combined = await retrieveHybridChunks(indexId, question)
  const ordered = await orderByRerank(question, combined)
  return promoteSymbolHit(ordered, question)
}

function appendKeywordChunk(
  chunks: SourceChunkRecord[],
  keyword: SourceChunkRecord | undefined,
): SourceChunkRecord[] {
  if (!keyword) return chunks
  if (chunks.some((chunk) => chunk.id === keyword.id)) return chunks
  return [...chunks, keyword]
}

async function orderByRerank(question: string, chunks: SourceChunkRecord[]): Promise<SourceChunkRecord[]> {
  if (chunks.length < 2) return chunks
  const scores = await rerankScores(question, chunks.map(chunkPassage))
  const ranked = chunks.map((chunk, index) => ({ chunk, score: scores[index] ?? 0, index }))
  ranked.sort((left, right) => right.score - left.score || left.index - right.index)
  return ranked.map((item) => item.chunk)
}

function chunkPassage(chunk: SourceChunkRecord): string {
  const header = chunk.symbol ? `${chunk.path} ${chunk.symbol}` : chunk.path
  return `${header}\n${chunk.content}`
}

type RerankResponse = {
  results?: { index?: number; relevance_score?: number }[]
}

async function rerankScores(question: string, passages: string[]): Promise<number[]> {
  const config = getConfig()
  const payload = { model: RERANK_MODEL_ID, query: question, documents: passages, top_n: passages.length }
  const response = await fetch(rerankUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`The rerank model failed with status ${response.status}. ${detail}`)
  }
  const body = (await response.json()) as RerankResponse
  const scores = passages.map(() => 0)
  for (const result of body.results ?? []) {
    if (result.index === undefined || result.relevance_score === undefined) continue
    scores[result.index] = result.relevance_score
  }
  return scores
}

function rerankUrl(): string {
  return 'https://openrouter.ai/api/v1/rerank'
}

async function vectorIds(indexId: string, question: string, topK: number): Promise<string[]> {
  const vector = await embedQuestion(formatQueryInput(question))
  const result = await getVectors().query(vector, {
    topK,
    namespace: indexId,
    returnValues: false,
    returnMetadata: 'none',
  })
  return (result.matches ?? []).map((match) => match.id)
}

type EmbeddingResponse = {
  data?: { embedding?: number[]; index?: number }[]
}

async function embedQuestion(question: string): Promise<number[]> {
  const config = getConfig()
  const payload = {
    model: EMBEDDING_MODEL_ID,
    input: [question],
    dimensions: EMBEDDING_DIMENSIONS,
    input_type: EMBEDDING_INPUT.query,
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
  const vector = body.data?.[0]?.embedding
  if (!vector) throw new Error('The question embedding is missing.')
  return vector
}

function embeddingUrl(accountId: string, gatewayId: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openrouter/embeddings`
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

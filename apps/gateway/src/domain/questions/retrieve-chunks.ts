import {
  CONTEXT_CHUNKS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_INPUT,
  EMBEDDING_MODEL_ID,
  formatQueryInput,
  keywordMatch,
  matchesScope,
  metadataFilter,
  promoteSymbolHit,
  RETRIEVAL_TOP_K,
  type SearchScope,
} from 'repotron-domain'
import type { SourceChunkRecord } from 'db'

import { getConfig, getRepositories, getVectors } from '../../context.ts'

export type SearchInput = {
  indexId: string
  question: string
  limit: number
  scope?: SearchScope
}

export async function semanticSearch(input: SearchInput): Promise<SourceChunkRecord[]> {
  const topK = input.scope ? RETRIEVAL_TOP_K : input.limit
  const ids = await vectorIds(input.indexId, input.question, topK, metadataFilter(input.scope))
  const rows = await rowsInOrder(input.indexId, ids)
  return rowsInScope(rows, input.scope).slice(0, input.limit)
}

export async function keywordSearch(input: SearchInput): Promise<SourceChunkRecord[]> {
  const ids = await keywordIds(input)
  const rows = await rowsInOrder(input.indexId, ids)
  return rowsInScope(rows, input.scope).slice(0, input.limit)
}

export async function retrieveAnswerChunks(
  indexId: string,
  question: string,
  scope?: SearchScope,
): Promise<SourceChunkRecord[]> {
  const semantic: SearchInput = { indexId, question, limit: CONTEXT_CHUNKS, scope }
  const keywords: SearchInput = { indexId, question, limit: RETRIEVAL_TOP_K, scope }
  const [semanticChunks, keywordChunks] = await Promise.all([
    semanticSearch(semantic),
    keywordSearch(keywords),
  ])
  const chunks = promoteSymbolHit(semanticChunks, question)
  return appendKeywordChunk(chunks, keywordChunks[0])
}

function appendKeywordChunk(
  chunks: SourceChunkRecord[],
  keyword: SourceChunkRecord | undefined,
): SourceChunkRecord[] {
  if (!keyword) return chunks
  if (chunks.some((chunk) => chunk.id === keyword.id)) return chunks
  return [...chunks, keyword]
}

async function vectorIds(
  indexId: string,
  question: string,
  topK: number,
  filter: ReturnType<typeof metadataFilter>,
): Promise<string[]> {
  const vector = await embedQuestion(formatQueryInput(question))
  const result = await getVectors().query(vector, {
    topK,
    namespace: indexId,
    returnValues: false,
    returnMetadata: 'none',
    ...(filter ? { filter } : {}),
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

function rowsInScope(rows: SourceChunkRecord[], scope: SearchScope | undefined): SourceChunkRecord[] {
  return rows.filter((row) => matchesScope(row.path, row.language, scope))
}

async function rowsInOrder(indexId: string, ids: string[]): Promise<SourceChunkRecord[]> {
  const rows = await getRepositories().sourceChunks.listByIds({ indexId, ids })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

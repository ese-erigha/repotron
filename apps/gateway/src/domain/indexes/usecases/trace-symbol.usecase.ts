import type { SymbolChunkRow } from 'db'
import {
  buildGithubLineUrl,
  ERROR_CODE,
  INDEX_STATUS,
  RATE_LIMIT_KIND,
  RETRIEVAL_TOP_K,
  SYMBOL_HIT_ROLE,
  type SymbolHit,
  type SymbolTrace,
} from 'repotron-domain'

import { getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { consumeLimit } from '../consume-limit.ts'

export type TraceSymbolInput = {
  indexId: string
  name: string
  remoteIp: string
}

export async function traceSymbol(input: TraceSymbolInput): Promise<SymbolTrace> {
  await consumeLimit(RATE_LIMIT_KIND.question, input.remoteIp)
  const index = await readReadyIndex(input.indexId)
  const repository = await readRepository(index.repositoryId)
  const rows = await listSymbolRows(input.indexId, input.name)
  const hits = orderSymbolHits(rows, input.name, index.commitSha, repository.owner, repository.name)
  return { symbol: input.name, hits }
}

async function readReadyIndex(indexId: string) {
  const index = await getRepositories().repositoryIndexes.get(indexId)
  if (!index) throw new RequestError(404, ERROR_CODE.notFound, 'The index does not exist.')
  if (index.status !== INDEX_STATUS.ready) {
    throw new RequestError(409, ERROR_CODE.indexNotReady, 'The index is not ready.')
  }
  return index
}

async function readRepository(repositoryId: string) {
  const repository = await getRepositories().githubRepositories.get(repositoryId)
  if (!repository) throw new RequestError(404, ERROR_CODE.notFound, 'The index does not exist.')
  return repository
}

async function listSymbolRows(indexId: string, name: string): Promise<SymbolChunkRow[]> {
  return getRepositories().sourceChunks.listBySymbol({
    indexId,
    match: symbolMatch(name),
    limit: RETRIEVAL_TOP_K,
  })
}

function symbolMatch(name: string): string {
  return `identifiers : "${name.replaceAll('"', '""')}"`
}

function orderSymbolHits(
  rows: SymbolChunkRow[],
  name: string,
  commitSha: string,
  owner: string,
  repositoryName: string,
): SymbolHit[] {
  const definitions: SymbolHit[] = []
  const usages: SymbolHit[] = []
  for (const row of rows) {
    const hit = toHit(row, name, commitSha, owner, repositoryName)
    if (hit.role === SYMBOL_HIT_ROLE.definition) definitions.push(hit)
    else usages.push(hit)
  }
  return [...definitions, ...usages]
}

function toHit(
  row: SymbolChunkRow,
  name: string,
  commitSha: string,
  owner: string,
  repositoryName: string,
): SymbolHit {
  const role = row.symbol === name ? SYMBOL_HIT_ROLE.definition : SYMBOL_HIT_ROLE.usage
  return {
    role,
    path: row.path,
    startLine: row.startLine,
    endLine: row.endLine,
    githubUrl: buildGithubLineUrl({
      owner,
      name: repositoryName,
      commitSha,
      path: row.path,
      startLine: row.startLine,
      endLine: row.endLine,
    }),
  }
}

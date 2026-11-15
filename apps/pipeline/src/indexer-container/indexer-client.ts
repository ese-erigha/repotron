import { getContainer } from '@cloudflare/containers'
import { log } from 'log'

import { getIndexer } from '../context.ts'
import { readParseResult, type ParseResult } from './parse-result.ts'

export type { ParseResult }

type ContainerClient = {
  fetch(request: Request): Promise<Response>
  destroy(): Promise<void>
}

export async function parseOnContainer(input: {
  indexId: string
  owner: string
  name: string
  commitSha: string
}): Promise<ParseResult> {
  const container = containerFor(input.indexId)
  const request = new Request('http://indexer/index', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const response = await container.fetch(request)
  return readParseResult(response)
}

export async function stopContainer(indexId: string): Promise<void> {
  try {
    await containerFor(indexId).destroy()
  } catch (error) {
    log.error('container_stop_failed', indexId, error instanceof Error ? error.name : 'Error')
  }
}

function containerFor(indexId: string): ContainerClient {
  return getContainer(getIndexer() as Parameters<typeof getContainer>[0], indexId)
}

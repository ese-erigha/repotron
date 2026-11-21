import { symbolTraceSchema, type SymbolTrace } from 'repotron-domain'

import { getHttpClient } from './client'
import { INDEX_PATH } from './endpoints'

export async function readSymbolTrace(indexId: string, name: string): Promise<SymbolTrace> {
  const body = await getHttpClient().get(INDEX_PATH.symbol(indexId, name))
  return symbolTraceSchema.parse(body)
}

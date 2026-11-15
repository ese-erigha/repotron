import type { IndexView } from 'repotron-domain'

import { getHttpClient } from './client'
import { INDEX_PATH } from './endpoints'

export type RequestIndexBody = { url: string; turnstileToken: string }

type RecentIndexesResponse = { indexes: IndexView[] }

/** Starts an index job, or returns the existing index of the commit. */
export async function requestIndex(body: RequestIndexBody): Promise<IndexView> {
  return getHttpClient().post<IndexView>(INDEX_PATH.LIST, body)
}

/** Reads one index with its status and its counts. */
export async function readIndex(indexId: string): Promise<IndexView> {
  return getHttpClient().get<IndexView>(INDEX_PATH.byId(indexId))
}

/** Lists the indexes that became ready most recently. */
export async function listRecentIndexes(): Promise<IndexView[]> {
  const response = await getHttpClient().get<RecentIndexesResponse>(INDEX_PATH.LIST)
  return response.indexes
}

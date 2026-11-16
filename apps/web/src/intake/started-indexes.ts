const STARTED_INDEX_KEY = 'repotron.started-indexes'
const STARTED_INDEX_LIMIT = 10

type IdStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The index ids this browser started, newest first. */
export function readStartedIndexIds(storage: IdStore): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STARTED_INDEX_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id !== '').slice(0, STARTED_INDEX_LIMIT)
  } catch {
    return []
  }
}

/** Remembers one index id. A repeat moves that id to the front. */
export function rememberStartedIndex(storage: IdStore, indexId: string): void {
  const ids = [indexId, ...readStartedIndexIds(storage).filter((id) => id !== indexId)].slice(0, STARTED_INDEX_LIMIT)
  storage.setItem(STARTED_INDEX_KEY, JSON.stringify(ids))
}

/** Drops one index id after it is ready, gone, or no longer useful on the home page. */
export function forgetStartedIndex(storage: IdStore, indexId: string): void {
  const ids = readStartedIndexIds(storage).filter((id) => id !== indexId)
  storage.setItem(STARTED_INDEX_KEY, JSON.stringify(ids))
}

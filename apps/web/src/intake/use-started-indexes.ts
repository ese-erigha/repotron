import { useEffect, useState } from 'react'
import { INDEX_STATUS, STATUS_POLL_MS, type IndexView } from 'repotron-domain'

import { asApiError } from '../services/api/http-client'
import { readIndex } from '../services/api/indexes.service'
import { isTerminalStatus } from '../index-status/index-stage'
import { forgetStartedIndex, readStartedIndexIds } from './started-indexes'

const NOT_FOUND = 404

/** The indexes this browser started that are still running or failed. */
export function useStartedIndexes(): IndexView[] {
  const [indexes, setIndexes] = useState<IndexView[]>([])

  useEffect(() => {
    let isCurrent = true
    let timer: number | undefined

    async function readStarted() {
      const ids = readStartedIndexIds(window.localStorage)
      const loaded = await Promise.all(ids.map((id) => readStartedIndex(id)))
      if (!isCurrent) return
      const views = loaded.flatMap((item) => (item.kind === 'view' ? [item.index] : []))
      setIndexes(views)
      const shouldPoll = loaded.some(
        (item) => item.kind === 'retry' || (item.kind === 'view' && !isTerminalStatus(item.index.status)),
      )
      if (shouldPoll) timer = window.setTimeout(() => void readStarted(), STATUS_POLL_MS)
    }

    void readStarted()
    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [])

  return indexes
}

type StartedRead = { kind: 'view'; index: IndexView } | { kind: 'drop' } | { kind: 'retry' }

/** Returns the view to show. A ready or missing index is dropped from the browser list. */
async function readStartedIndex(indexId: string): Promise<StartedRead> {
  try {
    const index = await readIndex(indexId)
    if (index.status === INDEX_STATUS.ready || index.status === INDEX_STATUS.deleting) {
      forgetStartedIndex(window.localStorage, indexId)
      return { kind: 'drop' }
    }
    return { kind: 'view', index }
  } catch (failure) {
    if (asApiError(failure).status === NOT_FOUND) {
      forgetStartedIndex(window.localStorage, indexId)
      return { kind: 'drop' }
    }
    return { kind: 'retry' }
  }
}

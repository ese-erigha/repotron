import { useCallback, useEffect, useState } from 'react'
import { STATUS_POLL_MS, type IndexView } from 'repotron-domain'

import { asApiError, type ApiError } from '../services/api/http-client'
import { readIndex } from '../services/api/indexes.service'
import { isTerminalStatus } from './index-stage'

const NOT_FOUND = 404

export type IndexStatusState = {
  index: IndexView | null
  error: ApiError | null
  /** True when the gateway states that the index does not exist. */
  isMissing: boolean
  /** Shows a view that a request returned, then reads the status again. A retry uses it. */
  watch(view: IndexView): void
}

/** The last result for one index id. A reading of another index id does not count. */
type Reading = {
  indexId: string | null
  index: IndexView | null
  error: ApiError | null
}

const NO_READING: Reading = { indexId: null, index: null, error: null }

/** Reads the status of an index every `STATUS_POLL_MS`, until the status is terminal. */
export function useIndexStatus(indexId: string | null): IndexStatusState {
  const [reading, setReading] = useState<Reading>(NO_READING)
  const [pollRound, setPollRound] = useState(0)

  useEffect(() => {
    if (indexId === null) return undefined
    let isCurrent = true
    let timer: number | undefined

    async function readStatus(id: string) {
      try {
        const index = await readIndex(id)
        if (!isCurrent) return
        setReading({ indexId: id, index, error: null })
        if (!isTerminalStatus(index.status)) timer = window.setTimeout(readStatus, STATUS_POLL_MS, id)
      } catch (failure) {
        if (!isCurrent) return
        const error = asApiError(failure)
        // The last good view stays on the screen while a later read fails.
        setReading((last) => ({ indexId: id, index: last.indexId === id ? last.index : null, error }))
        // A missing index stays missing. Any other failure can pass, so the next read still runs.
        if (error.status !== NOT_FOUND) timer = window.setTimeout(readStatus, STATUS_POLL_MS, id)
      }
    }

    void readStatus(indexId)
    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [indexId, pollRound])

  const watch = useCallback((view: IndexView) => {
    setReading({ indexId: view.id, index: view, error: null })
    setPollRound((round) => round + 1)
  }, [])

  const current = reading.indexId === indexId ? reading : NO_READING
  return {
    index: current.index,
    error: current.error,
    isMissing: current.error?.status === NOT_FOUND,
    watch,
  }
}

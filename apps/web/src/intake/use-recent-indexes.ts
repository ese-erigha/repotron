import { useEffect, useState } from 'react'
import type { IndexView } from 'repotron-domain'

import { asApiError, type ApiError } from '../services/api/http-client'
import { listRecentIndexes } from '../services/api/indexes.service'

export type RecentIndexesState = {
  indexes: IndexView[]
  isLoading: boolean
  error: ApiError | null
}

const LOADING: RecentIndexesState = { indexes: [], isLoading: true, error: null }

/** Loads the recently indexed repositories one time, when the screen opens. */
export function useRecentIndexes(): RecentIndexesState {
  const [state, setState] = useState<RecentIndexesState>(LOADING)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const indexes = await listRecentIndexes()
        if (isCurrent) setState({ indexes, isLoading: false, error: null })
      } catch (failure) {
        if (isCurrent) setState({ indexes: [], isLoading: false, error: asApiError(failure) })
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [])

  return state
}

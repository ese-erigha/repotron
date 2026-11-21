import { useEffect, useState } from 'react'
import type { EvalSummary } from 'repotron-domain'

import { asApiError, type ApiError } from '../services/api/http-client'
import { listEvalSummaries } from '../services/api/evals.service'

export type EvalHistoryState = {
  evals: EvalSummary[]
  isLoading: boolean
  error: ApiError | null
}

const LOADING: EvalHistoryState = { evals: [], isLoading: true, error: null }

/** Loads the saved score sheets one time, when the screen opens. */
export function useEvalHistory(): EvalHistoryState {
  const [state, setState] = useState<EvalHistoryState>(LOADING)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const evals = await listEvalSummaries()
        if (isCurrent) setState({ evals, isLoading: false, error: null })
      } catch (failure) {
        if (isCurrent) setState({ evals: [], isLoading: false, error: asApiError(failure) })
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [])

  return state
}

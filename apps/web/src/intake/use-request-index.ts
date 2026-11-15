import { useCallback, useState } from 'react'
import type { IndexView } from 'repotron-domain'

import { asApiError, type ApiError } from '../services/api/http-client'
import { requestIndex } from '../services/api/indexes.service'

export type RequestIndexState = {
  /** Resolves with the index, or with undefined after a failure. The failure is in `error`. */
  submit(url: string, turnstileToken: string): Promise<IndexView | undefined>
  isPending: boolean
  error: ApiError | null
}

/** Starts an index job for a repository link. */
export function useRequestIndex(): RequestIndexState {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const submit = useCallback(async (url: string, turnstileToken: string) => {
    setIsPending(true)
    setError(null)
    try {
      return await requestIndex({ url, turnstileToken })
    } catch (failure) {
      setError(asApiError(failure))
      return undefined
    } finally {
      setIsPending(false)
    }
  }, [])

  return { submit, isPending, error }
}

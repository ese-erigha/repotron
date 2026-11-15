import { useEffect, useState } from 'react'
import type { QuestionView } from 'repotron-domain'

import { asApiError, type ApiError } from '../services/api/http-client'
import { readQuestion } from '../services/api/questions.service'

export type SharedAnswerState = {
  question: QuestionView | null
  isLoading: boolean
  /** A missing answer gives `error.status` 404. */
  error: ApiError | null
}

/** The result of the read for one question id. */
type Loaded = {
  questionId: string
  question: QuestionView | null
  error: ApiError | null
}

/** Loads one stored answer. The answer page needs no index. */
export function useSharedAnswer(questionId: string): SharedAnswerState {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const question = await readQuestion(questionId)
        if (isCurrent) setLoaded({ questionId, question, error: null })
      } catch (failure) {
        if (isCurrent) setLoaded({ questionId, question: null, error: asApiError(failure) })
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [questionId])

  // A result for another question id is stale, so the screen shows the loading state.
  if (loaded === null || loaded.questionId !== questionId) return { question: null, isLoading: true, error: null }
  return { question: loaded.question, isLoading: false, error: loaded.error }
}

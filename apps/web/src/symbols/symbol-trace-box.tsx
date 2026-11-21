import { useState, type FormEvent } from 'react'
import { ERROR_CODE, type SymbolTrace } from 'repotron-domain'

import { readSymbolTrace } from '../services/api/symbols.service'
import { ApiError } from '../services/api/http-client'
import { Button } from '../ui/button'
import { ErrorMessage } from '../ui/error-message'
import { readErrorText, type ErrorDetail } from '../ui/error-text'
import { SYMBOL_TRACE_TEXT } from './symbol-trace.constants'
import { SymbolTraceList } from './symbol-trace-list'

type SymbolTraceBoxProps = {
  indexId: string
}

export function SymbolTraceBox({ indexId }: SymbolTraceBoxProps) {
  const [name, setName] = useState('')
  const [trace, setTrace] = useState<SymbolTrace | null>(null)
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const trimmed = name.trim()

  async function submitTrace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmed === '' || isPending) return
    setIsPending(true)
    setError('')
    try {
      const result = await readSymbolTrace(indexId, trimmed)
      setTrace(result)
    } catch (failure) {
      setTrace(null)
      setError(readErrorText(errorDetail(failure)))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <section aria-labelledby="symbol-trace-title" className="space-y-3">
      <h2 id="symbol-trace-title" className="px-1 text-[13px] font-semibold tracking-wide text-mute uppercase">
        {SYMBOL_TRACE_TEXT.TITLE}
      </h2>
      <form onSubmit={submitTrace} className="flex flex-wrap items-center gap-2">
        <label className="min-w-40 flex-1 text-[13px] text-mute">
          <span className="sr-only">{SYMBOL_TRACE_TEXT.LABEL}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={SYMBOL_TRACE_TEXT.PLACEHOLDER}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-faint"
          />
        </label>
        <Button type="submit" disabled={trimmed === ''} isPending={isPending}>
          {SYMBOL_TRACE_TEXT.SUBMIT}
        </Button>
      </form>
      {error !== '' ? <ErrorMessage message={error} /> : null}
      {trace ? <SymbolTraceList hits={trace.hits} /> : null}
    </section>
  )
}

function errorDetail(failure: unknown): ErrorDetail {
  if (failure instanceof ApiError) {
    return { code: failure.code, message: failure.message, retryAfterSeconds: failure.retryAfterSeconds }
  }
  return { code: ERROR_CODE.internal, message: 'Something went wrong.' }
}

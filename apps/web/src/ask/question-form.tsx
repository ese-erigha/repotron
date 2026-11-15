import { ArrowUp } from 'lucide-react'
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { QUESTION_MAX_CHARS } from 'repotron-domain'

import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { ASK_TEXT, QUESTION_WARNING_SHARE } from './ask.constants'

type QuestionFormProps = {
  onSubmit(question: string): void
  /** The preset buttons. They sit in the bottom row of the field. */
  presets: ReactNode
}

export function QuestionForm({ onSubmit, presets }: QuestionFormProps) {
  const inputId = useId()
  const [question, setQuestion] = useState('')
  const trimmed = question.trim()
  const isNearLimit = question.length >= QUESTION_MAX_CHARS * QUESTION_WARNING_SHARE

  function submitQuestion() {
    if (trimmed === '') return
    onSubmit(trimmed)
    setQuestion('')
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitQuestion()
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Shift + Enter adds a line. Enter during text composition belongs to the input method.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submitQuestion()
  }

  return (
    <form onSubmit={submitForm} className="surface-raised field-shell p-2">
      <label htmlFor={inputId} className="sr-only">
        {ASK_TEXT.QUESTION_LABEL}
      </label>
      <textarea
        id={inputId}
        rows={2}
        value={question}
        maxLength={QUESTION_MAX_CHARS}
        placeholder={ASK_TEXT.PLACEHOLDER}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={submitOnEnter}
        className="thin-scrollbar field-sizing-content max-h-52 min-h-14 w-full resize-none bg-transparent px-3 pt-2.5 text-base leading-relaxed text-ink placeholder:text-faint"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {presets}
        <div className="ml-auto flex items-center gap-3">
          <span
            className={cn('font-mono text-xs tabular-nums', isNearLimit ? 'text-warning' : 'text-mute')}
            aria-hidden={!isNearLimit}
          >
            {question.length} / {QUESTION_MAX_CHARS}
          </span>
          <Button type="submit" disabled={trimmed === ''} title={ASK_TEXT.SUBMIT_HINT}>
            {ASK_TEXT.SUBMIT}
            <ArrowUp aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}

import { ArrowRight } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { parseRepositoryLink } from 'repotron-domain'

import { GithubMark } from '../github/github-mark'
import { TurnstileWidget } from '../turnstile/turnstile-widget'
import { Button } from '../ui/button'
import { BUTTON_SIZE } from '../ui/button.constants'
import { ErrorMessage } from '../ui/error-message'
import { readErrorText, type ErrorDetail } from '../ui/error-text'
import { INTAKE_TEXT } from './intake.constants'
import { normalizeRepositoryLink } from './normalize-repository-link'

type RepositoryLinkFormProps = {
  isPending: boolean
  error: ErrorDetail | null
  turnstileResetKey: number
  onSubmit(url: string, turnstileToken: string): void
}

export function RepositoryLinkForm({ isPending, error, turnstileResetKey, onSubmit }: RepositoryLinkFormProps) {
  const inputId = useId()
  const [url, setUrl] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [isLinkInvalid, setIsLinkInvalid] = useState(false)
  const link = normalizeRepositoryLink(url)
  const errorText = isLinkInvalid ? INTAKE_TEXT.INVALID_LINK : error ? readErrorText(error) : null

  function changeUrl(value: string) {
    setUrl(value)
    setIsLinkInvalid(false)
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // A bad link shows its error at once. It uses no Turnstile token and no rate limit unit.
    if (!parseRepositoryLink(link)) {
      setIsLinkInvalid(true)
      return
    }
    if (turnstileToken !== null) onSubmit(link, turnstileToken)
  }

  return (
    <form onSubmit={submitLink} noValidate className="animate-rise text-left [animation-delay:80ms]">
      <label htmlFor={inputId} className="mb-2 block px-1 text-[13px] font-medium text-ink-soft">
        {INTAKE_TEXT.LINK_LABEL}
      </label>
      <div className="surface-raised field-shell flex h-[60px] items-center gap-3 pr-2 pl-4">
        <GithubMark className="size-5 shrink-0 text-ink-soft" />
        <input
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={url}
          placeholder={INTAKE_TEXT.LINK_PLACEHOLDER}
          aria-invalid={errorText !== null}
          onChange={(event) => changeUrl(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint"
        />
        <Button
          type="submit"
          size={BUTTON_SIZE.LG}
          isPending={isPending}
          disabled={link === '' || turnstileToken === null}
          className="max-sm:px-3.5"
        >
          <span className="max-sm:sr-only">{INTAKE_TEXT.SUBMIT}</span>
          {isPending ? null : <ArrowRight aria-hidden className="size-4" />}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-1">
        <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
        <p className="text-[13px] text-mute">{INTAKE_TEXT.LINK_HINT}</p>
      </div>
      {errorText ? <ErrorMessage message={errorText} className="mt-3 px-1" /> : null}
    </form>
  )
}

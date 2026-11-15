import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'

import { answerPath } from '../shell/navigation.constants'
import { Button } from '../ui/button'
import { BUTTON_SIZE, BUTTON_VARIANT } from '../ui/button.constants'
import { ASK_TEXT } from './ask.constants'

type ShareButtonProps = { questionId: string }

const SHARE_STATE = {
  IDLE: 'idle',
  COPIED: 'copied',
  /** The browser refused the clipboard write, so the user copies the link by hand. */
  FAILED: 'failed',
} as const

type ShareState = (typeof SHARE_STATE)[keyof typeof SHARE_STATE]

/** Copies the link of the answer page. The page needs no index, so the link keeps working. */
export function ShareButton({ questionId }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>(SHARE_STATE.IDLE)
  const link = `${window.location.origin}${answerPath(questionId)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setState(SHARE_STATE.COPIED)
    } catch {
      setState(SHARE_STATE.FAILED)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant={BUTTON_VARIANT.SECONDARY} size={BUTTON_SIZE.SM} onClick={copyLink}>
          {state === SHARE_STATE.COPIED ? (
            <Check aria-hidden className="size-3.5 text-success" />
          ) : (
            <Link2 aria-hidden className="size-3.5" />
          )}
          {ASK_TEXT.SHARE}
        </Button>
        <p role="status" className="min-w-0 text-[13px] text-mute">
          {state === SHARE_STATE.COPIED ? ASK_TEXT.SHARE_COPIED : null}
          {state === SHARE_STATE.FAILED ? ASK_TEXT.SHARE_FAILED : null}
        </p>
      </div>
      {state === SHARE_STATE.FAILED ? (
        <p className="mt-3 rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-xs break-all text-ink-soft select-all">
          {link}
        </p>
      ) : null}
    </div>
  )
}

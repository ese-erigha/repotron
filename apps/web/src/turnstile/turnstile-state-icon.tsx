import { Check, CircleAlert } from 'lucide-react'

import { Spinner } from '../ui/spinner'
import { TURNSTILE_STATE, type TurnstileState } from './turnstile.constants'

type TurnstileStateIconProps = { state: TurnstileState }

export function TurnstileStateIcon({ state }: TurnstileStateIconProps) {
  if (state === TURNSTILE_STATE.VERIFIED) return <Check aria-hidden className="size-3.5 text-success" />
  if (state === TURNSTILE_STATE.FAILED) return <CircleAlert aria-hidden className="size-3.5" />
  return <Spinner className="size-3.5" />
}

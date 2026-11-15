import { LoaderCircle } from 'lucide-react'

import { cn } from './cn'

type SpinnerProps = { className?: string }

export function Spinner({ className }: SpinnerProps) {
  return <LoaderCircle aria-hidden className={cn('size-4 animate-spin', className)} />
}

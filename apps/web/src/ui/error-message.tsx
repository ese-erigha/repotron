import { CircleAlert } from 'lucide-react'

import { cn } from './cn'

type ErrorMessageProps = {
  message: string
  className?: string
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <p role="alert" className={cn('flex items-start gap-2 text-sm leading-relaxed text-danger', className)}>
      <CircleAlert aria-hidden className="mt-[3px] size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

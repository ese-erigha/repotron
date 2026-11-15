import type { ReactNode } from 'react'

import { cn } from './cn'

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description?: string
  className?: string
  children?: ReactNode
}

export function EmptyState({ icon, title, description, className, children }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="grid size-12 place-items-center rounded-2xl border border-line bg-surface text-mute shadow-card">
        {icon}
      </div>
      <h2 className="mt-4 text-[15px] font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-mute">{description}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}

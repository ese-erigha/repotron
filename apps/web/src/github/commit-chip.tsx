import { GitCommitHorizontal } from 'lucide-react'

import { cn } from '../ui/cn'
import { shortSha } from '../ui/format'

type CommitChipProps = {
  commitSha: string
  className?: string
}

/** The short sha of the commit that an index holds. */
export function CommitChip({ commitSha, className }: CommitChipProps) {
  return (
    <span
      title={commitSha}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-px font-mono text-xs text-ink-soft',
        className,
      )}
    >
      <GitCommitHorizontal aria-hidden className="size-3.5 text-faint" />
      {shortSha(commitSha)}
    </span>
  )
}

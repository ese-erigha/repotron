import { cn } from './cn'

type SkeletonProps = { className?: string }

/** A placeholder with a moving shine. It holds the space of content that loads. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn('skeleton', className)} />
}

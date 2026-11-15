import { useState } from 'react'

import { cn } from '../ui/cn'
import { githubAvatarUrl } from './github-links'

type GithubAvatarProps = {
  owner: string
  className?: string
}

/** The picture of a repository owner. The first letter of the name shows when the picture fails. */
export function GithubAvatar({ owner, className }: GithubAvatarProps) {
  const [hasFailed, setHasFailed] = useState(false)

  return (
    <span
      aria-hidden
      className={cn(
        'relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-sunken text-sm font-semibold text-mute uppercase',
        className,
      )}
    >
      {hasFailed ? (
        owner.charAt(0)
      ) : (
        <img
          src={githubAvatarUrl(owner)}
          alt=""
          loading="lazy"
          onError={() => setHasFailed(true)}
          className="absolute inset-0 size-full bg-surface object-cover"
        />
      )}
    </span>
  )
}

import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { IndexView } from 'repotron-domain'

import { CommitChip } from '../github/commit-chip'
import { GithubAvatar } from '../github/github-avatar'
import { repositoryPath } from '../shell/navigation.constants'
import { formatCount, formatRelativeTime } from '../ui/format'
import { INTAKE_TEXT } from './intake.constants'

type RecentIndexRowProps = {
  index: IndexView
  now: number
}

export function RecentIndexRow({ index, now }: RecentIndexRowProps) {
  const { owner, name } = index.repository

  return (
    <Link
      to={repositoryPath(owner, name, index.id)}
      className="surface-card group flex items-center gap-3.5 p-3.5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-raised"
    >
      <GithubAvatar owner={owner} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-snug">
          <span className="text-mute">{owner}/</span>
          <span className="font-semibold text-ink">{name}</span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-mute">
          <CommitChip commitSha={index.commitSha} />
          {index.fileCount === null ? null : (
            <span className="truncate">
              {formatCount(index.fileCount)} {INTAKE_TEXT.FILES}
            </span>
          )}
          <span aria-hidden className="text-line-strong">
            ·
          </span>
          <span className="shrink-0">{formatRelativeTime(index.readyAt ?? index.createdAt, now)}</span>
        </p>
      </div>
      <ArrowRight
        aria-hidden
        className="mr-1 size-4 shrink-0 text-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-ink"
      />
    </Link>
  )
}

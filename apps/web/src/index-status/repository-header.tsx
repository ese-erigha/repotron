import { ArrowUpRight } from 'lucide-react'
import { INDEX_STATUS, type IndexView } from 'repotron-domain'

import { CommitChip } from '../github/commit-chip'
import { GithubAvatar } from '../github/github-avatar'
import { githubCommitTreeUrl, githubRepositoryUrl } from '../github/github-links'
import { GithubMark } from '../github/github-mark'
import { BUTTON_SIZE, BUTTON_VARIANT, buttonClassName } from '../ui/button.constants'
import { ExternalLink } from '../ui/external-link'
import { formatCount } from '../ui/format'
import { INDEX_STATUS_TEXT } from './index-status.constants'
import { IndexStatusPill } from './index-status-pill'

type RepositoryHeaderProps = {
  owner: string
  name: string
  /** The index of the URL. It is null before the first status read and on the start card. */
  index: IndexView | null
}

export function RepositoryHeader({ owner, name, index }: RepositoryHeaderProps) {
  const githubUrl =
    index === null ? githubRepositoryUrl(owner, name) : githubCommitTreeUrl(owner, name, index.commitSha)
  const isReady = index?.status === INDEX_STATUS.ready

  return (
    <header className="pt-8 pb-6 sm:pt-10">
      <div className="flex items-center gap-3.5">
        <GithubAvatar owner={owner} className="size-11 rounded-xl" />
        <h1 className="min-w-0 flex-1 truncate text-2xl leading-tight tracking-[-0.02em] sm:text-[1.75rem]">
          <span className="text-mute">{owner}/</span>
          <span className="font-semibold text-ink">{name}</span>
        </h1>
        <ExternalLink href={githubUrl} className={buttonClassName(BUTTON_VARIANT.SECONDARY, BUTTON_SIZE.SM)}>
          <GithubMark className="size-3.5" />
          <span className="max-sm:sr-only">{INDEX_STATUS_TEXT.GITHUB}</span>
          <ArrowUpRight aria-hidden className="size-3.5 text-faint" />
        </ExternalLink>
      </div>
      {index === null ? null : (
        <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-mute sm:mt-1.5 sm:pl-[3.625rem]">
          <CommitChip commitSha={index.commitSha} />
          {isReady && index.fileCount !== null ? (
            <span>
              {formatCount(index.fileCount)} {INDEX_STATUS_TEXT.HEADER_FILES}
            </span>
          ) : null}
          {isReady && index.chunkCount !== null ? (
            <span>
              {formatCount(index.chunkCount)} {INDEX_STATUS_TEXT.HEADER_CHUNKS}
            </span>
          ) : null}
          <IndexStatusPill index={index} />
        </p>
      )}
    </header>
  )
}

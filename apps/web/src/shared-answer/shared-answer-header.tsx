import { ArrowUpRight, Link2 } from 'lucide-react'
import type { QuestionView } from 'repotron-domain'

import { CommitChip } from '../github/commit-chip'
import { GithubAvatar } from '../github/github-avatar'
import { githubCommitTreeUrl } from '../github/github-links'
import { GithubMark } from '../github/github-mark'
import { BUTTON_SIZE, BUTTON_VARIANT, buttonClassName } from '../ui/button.constants'
import { cn } from '../ui/cn'
import { ExternalLink } from '../ui/external-link'
import { formatDate } from '../ui/format'
import { SHARED_ANSWER_TEXT } from './shared-answer.constants'

type SharedAnswerHeaderProps = {
  question: QuestionView
  owner: string
  name: string
}

/** The repository, the commit, and the day of a shared answer. */
export function SharedAnswerHeader({ question, owner, name }: SharedAnswerHeaderProps) {
  return (
    <header className="pt-8 pb-7 sm:pt-10">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
        <Link2 aria-hidden className="size-3.5" />
        {SHARED_ANSWER_TEXT.BADGE}
      </p>
      <div className="mt-4 flex items-center gap-3.5">
        <GithubAvatar owner={owner} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-tight tracking-[-0.01em]">
            <span className="text-mute">{owner}/</span>
            <span className="font-semibold text-ink">{name}</span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-mute">
            <CommitChip commitSha={question.commitSha} />
            <time dateTime={new Date(question.createdAt).toISOString()}>{formatDate(question.createdAt)}</time>
          </p>
        </div>
        <ExternalLink
          href={githubCommitTreeUrl(owner, name, question.commitSha)}
          className={cn(buttonClassName(BUTTON_VARIANT.SECONDARY, BUTTON_SIZE.SM))}
        >
          <GithubMark className="size-3.5" />
          <span className="max-sm:sr-only">{SHARED_ANSWER_TEXT.GITHUB}</span>
          <ArrowUpRight aria-hidden className="size-3.5 text-faint" />
        </ExternalLink>
      </div>
    </header>
  )
}

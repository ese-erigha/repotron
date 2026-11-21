import { SearchX, Unplug } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { AskPanel } from '../ask/ask-panel'
import { useAnswerStream } from '../ask/use-answer-stream'
import { githubRepositoryUrl } from '../github/github-links'
import { IndexFailureCard } from '../index-status/index-failure-card'
import { IndexStatusCard } from '../index-status/index-status-card'
import { INDEX_STATUS_TEXT } from '../index-status/index-status.constants'
import { ReindexBanner } from '../index-status/reindex-banner'
import { RepositoryHeader } from '../index-status/repository-header'
import { activeIndexIdOf, REPOSITORY_VIEW, selectRepositoryView } from '../index-status/repository-view'
import { useIndexStatus } from '../index-status/use-index-status'
import { StartIndexCard } from '../intake/start-index-card'
import { useRequestIndex } from '../intake/use-request-index'
import { HomeLink } from '../shell/home-link'
import { INDEX_QUERY } from '../shell/navigation.constants'
import { useDocumentTitle } from '../shell/use-document-title'
import { cn } from '../ui/cn'
import { EmptyState } from '../ui/empty-state'
import { readErrorText } from '../ui/error-text'
import { Skeleton } from '../ui/skeleton'

export function RepositoryScreen() {
  const { owner = '', repo = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const indexId = searchParams.get(INDEX_QUERY)
  const status = useIndexStatus(indexId)
  const request = useRequestIndex()
  const stream = useAnswerStream(activeIndexIdOf(status.index))
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const repository = status.index?.repository ?? { owner, name: repo }
  const view = selectRepositoryView({
    indexId,
    index: status.index,
    isMissing: status.isMissing,
    hasError: status.error !== null,
  })
  const hasAskPanel = view === REPOSITORY_VIEW.ASK || view === REPOSITORY_VIEW.REINDEXING
  useDocumentTitle(`${repository.owner}/${repository.name}`)

  /** Starts the index job of this repository, or restarts a failed one. The gateway keeps the same index id. */
  async function startIndex(turnstileToken: string) {
    const index = await request.submit(githubRepositoryUrl(owner, repo), turnstileToken)
    // A token works once, so the widget makes a new one after each response.
    setTurnstileResetKey((key) => key + 1)
    if (!index) return
    status.watch(index)
    setSearchParams({ [INDEX_QUERY]: index.id }, { replace: true })
  }

  function renderView() {
    switch (view) {
      case REPOSITORY_VIEW.START:
        return (
          <StartIndexCard
            isPending={request.isPending}
            error={request.error}
            turnstileResetKey={turnstileResetKey}
            onSubmit={startIndex}
          />
        )
      case REPOSITORY_VIEW.LOADING:
        return <Skeleton className="h-72 rounded-2xl" />
      case REPOSITORY_VIEW.MISSING:
        return (
          <EmptyState
            icon={<SearchX aria-hidden className="size-5" />}
            title={INDEX_STATUS_TEXT.MISSING_TITLE}
            description={INDEX_STATUS_TEXT.MISSING_DESCRIPTION}
          >
            <HomeLink label={INDEX_STATUS_TEXT.HOME_ACTION} />
          </EmptyState>
        )
      case REPOSITORY_VIEW.UNAVAILABLE:
        return (
          <EmptyState
            icon={<Unplug aria-hidden className="size-5" />}
            title={status.error ? readErrorText(status.error) : ''}
          />
        )
      case REPOSITORY_VIEW.INDEXING:
        return status.index ? <IndexStatusCard index={status.index} /> : null
      case REPOSITORY_VIEW.FAILED:
        return status.index ? (
          <IndexFailureCard
            index={status.index}
            isPending={request.isPending}
            error={request.error}
            turnstileResetKey={turnstileResetKey}
            onRetry={startIndex}
          />
        ) : null
      case REPOSITORY_VIEW.REINDEXING:
        return (
          <div className="space-y-6">
            {status.index ? <ReindexBanner status={status.index.status} /> : null}
            <AskPanel answer={stream.answer} onAsk={stream.ask} />
          </div>
        )
      case REPOSITORY_VIEW.ASK:
        return <AskPanel answer={stream.answer} onAsk={stream.ask} />
    }
  }

  return (
    <div className={cn('mx-auto', hasAskPanel ? 'max-w-none' : 'max-w-3xl pb-20')}>
      <RepositoryHeader owner={repository.owner} name={repository.name} index={status.index} />
      {renderView()}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { HomeHero } from '../intake/home-hero'
import { IntakeSteps } from '../intake/intake-steps'
import { RecentIndexList } from '../intake/recent-index-list'
import { rememberStartedIndex } from '../intake/started-indexes'
import { StartedIndexList } from '../intake/started-index-list'
import { RepositoryLinkForm } from '../intake/repository-link-form'
import { useRecentIndexes } from '../intake/use-recent-indexes'
import { useRequestIndex } from '../intake/use-request-index'
import { useStartedIndexes } from '../intake/use-started-indexes'
import { repositoryPath } from '../shell/navigation.constants'
import { SHELL_TEXT } from '../shell/shell.constants'
import { useDocumentTitle } from '../shell/use-document-title'

export function HomeScreen() {
  const navigate = useNavigate()
  const request = useRequestIndex()
  const recent = useRecentIndexes()
  const started = useStartedIndexes()
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  useDocumentTitle(SHELL_TEXT.TAGLINE)

  async function startIndex(url: string, turnstileToken: string) {
    const index = await request.submit(url, turnstileToken)
    // A token works once, so the widget makes a new one after each response.
    setTurnstileResetKey((key) => key + 1)
    if (!index) return
    rememberStartedIndex(window.localStorage, index.id)
    navigate(repositoryPath(index.repository.owner, index.repository.name, index.id))
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <HomeHero />
      <RepositoryLinkForm
        isPending={request.isPending}
        error={request.error}
        turnstileResetKey={turnstileResetKey}
        onSubmit={startIndex}
      />
      <StartedIndexList indexes={started} />
      <RecentIndexList indexes={recent.indexes} isLoading={recent.isLoading} hasFailed={recent.error !== null} />
      <IntakeSteps />
    </div>
  )
}

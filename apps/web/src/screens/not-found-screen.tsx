import { Compass } from 'lucide-react'

import { HomeLink } from '../shell/home-link'
import { useDocumentTitle } from '../shell/use-document-title'
import { EmptyState } from '../ui/empty-state'

const NOT_FOUND_TEXT = {
  TITLE: 'This page does not exist.',
  DESCRIPTION: 'Check the address, or start from the home screen.',
  HOME_ACTION: 'Go to Home',
} as const

export function NotFoundScreen() {
  useDocumentTitle(NOT_FOUND_TEXT.TITLE)

  return (
    <EmptyState
      className="pt-24 pb-20"
      icon={<Compass aria-hidden className="size-5" />}
      title={NOT_FOUND_TEXT.TITLE}
      description={NOT_FOUND_TEXT.DESCRIPTION}
    >
      <HomeLink label={NOT_FOUND_TEXT.HOME_ACTION} />
    </EmptyState>
  )
}

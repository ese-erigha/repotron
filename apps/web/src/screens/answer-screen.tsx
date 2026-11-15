import { SearchX } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { AnswerView } from '../ask/answer-view'
import { CitationPanel } from '../citations/citation-panel'
import { SourcesLayout } from '../citations/sources-layout'
import { useCitationFocus } from '../citations/use-citation-focus'
import { AskYourOwn } from '../shared-answer/ask-your-own'
import { SharedAnswerHeader } from '../shared-answer/shared-answer-header'
import { SHARED_ANSWER_TEXT } from '../shared-answer/shared-answer.constants'
import { useSharedAnswer } from '../shared-answer/use-shared-answer'
import { HomeLink } from '../shell/home-link'
import { useDocumentTitle } from '../shell/use-document-title'
import { EmptyState } from '../ui/empty-state'
import { readErrorText } from '../ui/error-text'
import { Skeleton } from '../ui/skeleton'
import { SurfaceCard } from '../ui/surface-card'

const NOT_FOUND = 404

export function AnswerScreen() {
  const { id = '' } = useParams()
  const shared = useSharedAnswer(id)
  const { focusedNumber, focusCitation } = useCitationFocus()
  useDocumentTitle(shared.question?.question ?? SHARED_ANSWER_TEXT.BADGE)

  if (shared.isLoading) {
    return (
      <div aria-hidden className="mx-auto max-w-3xl space-y-5 pt-10 pb-20">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  if (shared.question === null) {
    // A missing answer has its own text. Any other failure shows the text of the error.
    const failure = shared.error !== null && shared.error.status !== NOT_FOUND ? shared.error : null
    return (
      <EmptyState
        className="pt-24 pb-20"
        icon={<SearchX aria-hidden className="size-5" />}
        title={failure ? readErrorText(failure) : SHARED_ANSWER_TEXT.MISSING_TITLE}
        description={failure ? undefined : SHARED_ANSWER_TEXT.MISSING_DESCRIPTION}
      >
        <HomeLink label={SHARED_ANSWER_TEXT.HOME_ACTION} />
      </EmptyState>
    )
  }

  const { question } = shared
  const [owner = '', name = ''] = question.repositoryFullName.split('/')
  const sourceNumbers = question.citations.map((citation) => citation.number)

  return (
    <div>
      <SharedAnswerHeader question={question} owner={owner} name={name} />
      <SourcesLayout
        sources={
          <CitationPanel
            citations={question.citations}
            citedNumbers={sourceNumbers}
            focusedNumber={focusedNumber}
            isLoading={false}
          />
        }
      >
        <div className="animate-rise">
          <h1 className="px-1 text-2xl leading-snug font-semibold tracking-[-0.02em] text-balance text-ink sm:text-[1.75rem]">
            {question.question}
          </h1>
          <SurfaceCard className="mt-5 p-5 sm:p-7">
            <AnswerView
              text={question.answer}
              sourceNumbers={sourceNumbers}
              isStreaming={false}
              onSelectCitation={focusCitation}
            />
          </SurfaceCard>
          <div className="mt-6">
            <AskYourOwn owner={owner} name={name} />
          </div>
        </div>
      </SourcesLayout>
    </div>
  )
}

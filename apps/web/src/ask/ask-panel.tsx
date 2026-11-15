import { useState } from 'react'
import { readCitedNumbers } from 'repotron-domain'

import { CitationPanel } from '../citations/citation-panel'
import { SourcesLayout } from '../citations/sources-layout'
import { useCitationFocus } from '../citations/use-citation-focus'
import { AnswerCard } from './answer-card'
import { ANSWER_PHASE, type AnswerStreamState } from './answer-stream-state'
import { ASK_TEXT } from './ask.constants'
import { explainFeatureRequest, questionRequest, startHereRequest, type AskRequest } from './ask-request'
import { FeatureNameDialog } from './feature-name-dialog'
import { PresetButtons } from './preset-buttons'
import { QuestionForm } from './question-form'
import { QuestionSuggestions } from './question-suggestions'

type AskPanelProps = {
  answer: AnswerStreamState
  onAsk(request: AskRequest): void
}

/** The question form, the answer, and the sources of one index. */
export function AskPanel({ answer, onAsk }: AskPanelProps) {
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false)
  const [lastRequest, setLastRequest] = useState<AskRequest | null>(null)
  const { focusedNumber, focusCitation } = useCitationFocus()
  const isIdle = answer.phase === ANSWER_PHASE.IDLE
  const citedNumbers = readCitedNumbers(answer.text, answer.citations.length)

  /** Keeps the request, so a failed answer can ask it again. */
  function ask(request: AskRequest) {
    setLastRequest(request)
    onAsk(request)
  }

  function explainFeature(featureName: string) {
    setIsFeatureDialogOpen(false)
    ask(explainFeatureRequest(featureName))
  }

  function askAgain() {
    if (lastRequest !== null) onAsk(lastRequest)
  }

  return (
    <SourcesLayout
      sources={
        <CitationPanel
          citations={answer.citations}
          citedNumbers={citedNumbers}
          focusedNumber={focusedNumber}
          isLoading={answer.phase === ANSWER_PHASE.WAITING}
        />
      }
    >
      <div className="space-y-8">
        <QuestionForm
          onSubmit={(question) => ask(questionRequest(question))}
          presets={
            <PresetButtons
              onStartHere={() => ask(startHereRequest())}
              onExplainFeature={() => setIsFeatureDialogOpen(true)}
            />
          }
        />
        {isIdle ? (
          <QuestionSuggestions onSelect={(question) => ask(questionRequest(question))} />
        ) : (
          <AnswerCard answer={answer} onSelectCitation={focusCitation} onRetry={askAgain} />
        )}
        <p className="px-1 text-[13px] text-mute">{ASK_TEXT.DISCLAIMER}</p>
      </div>
      {isFeatureDialogOpen ? (
        <FeatureNameDialog onClose={() => setIsFeatureDialogOpen(false)} onSubmit={explainFeature} />
      ) : null}
    </SourcesLayout>
  )
}

import { CornerDownLeft } from 'lucide-react'

import { ASK_TEXT, QUESTION_SUGGESTIONS } from './ask.constants'

type QuestionSuggestionsProps = {
  onSelect(question: string): void
}

/** Starter questions for the time before the first answer. A select asks the question. */
export function QuestionSuggestions({ onSelect }: QuestionSuggestionsProps) {
  return (
    <section aria-labelledby="suggestions-title" className="animate-rise [animation-delay:120ms]">
      <h2 id="suggestions-title" className="px-1 text-[13px] font-semibold tracking-wide text-mute uppercase">
        {ASK_TEXT.SUGGESTIONS_TITLE}
      </h2>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/70">
        {QUESTION_SUGGESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onSelect(question)}
              className="group flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[15px] text-ink-soft transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              {question}
              <CornerDownLeft
                aria-hidden
                className="size-4 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

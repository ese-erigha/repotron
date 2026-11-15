import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { repositoryPath } from '../shell/navigation.constants'
import { SHARED_ANSWER_TEXT } from './shared-answer.constants'

type AskYourOwnProps = {
  owner: string
  name: string
}

/** Leads the reader of a shared answer to the repository screen, to ask a new question. */
export function AskYourOwn({ owner, name }: AskYourOwnProps) {
  return (
    <Link
      to={repositoryPath(owner, name)}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface/70 px-5 py-4 transition-[border-color,background-color,box-shadow] duration-200 hover:border-line-strong hover:bg-surface hover:shadow-raised"
    >
      <span>
        <span className="block text-[15px] font-semibold text-ink">{SHARED_ANSWER_TEXT.ASK_YOUR_OWN}</span>
        <span className="mt-0.5 block text-sm text-mute">{SHARED_ANSWER_TEXT.ASK_YOUR_OWN_TEXT}</span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white transition-transform duration-200 group-hover:translate-x-0.5">
        <ArrowRight aria-hidden className="size-4" />
      </span>
    </Link>
  )
}

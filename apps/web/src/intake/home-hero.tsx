import { Quote } from 'lucide-react'

import { INTAKE_TEXT } from './intake.constants'

export function HomeHero() {
  return (
    <header className="animate-rise pt-14 pb-10 text-center sm:pt-24">
      <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-3.5 pl-1.5 text-[13px] font-medium text-ink-soft shadow-card backdrop-blur">
        <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-accent">
          <Quote aria-hidden className="size-3" />
        </span>
        {INTAKE_TEXT.BADGE}
      </p>
      <h1 className="mx-auto mt-6 max-w-2xl text-[2.5rem] leading-[1.06] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-[3.5rem]">
        {INTAKE_TEXT.TITLE}{' '}
        <span className="bg-linear-to-r from-accent to-glow bg-clip-text text-transparent">
          {INTAKE_TEXT.TITLE_ACCENT}
        </span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-mute">
        {INTAKE_TEXT.SUBTITLE}
      </p>
    </header>
  )
}

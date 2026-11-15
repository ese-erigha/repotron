import { INTAKE_STEPS, INTAKE_TEXT } from './intake.constants'

/** The 3 steps of the product, for a first visit. */
export function IntakeSteps() {
  return (
    <section aria-labelledby="steps-title" className="mt-14">
      <h2 id="steps-title" className="px-1 text-[13px] font-semibold tracking-wide text-mute uppercase">
        {INTAKE_TEXT.STEPS_TITLE}
      </h2>
      <ol className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {INTAKE_STEPS.map((step, position) => (
          <li key={step.title} className="bg-surface/70 p-5">
            <span className="font-mono text-xs text-accent">{String(position + 1).padStart(2, '0')}</span>
            <h3 className="mt-2 text-[15px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-mute">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

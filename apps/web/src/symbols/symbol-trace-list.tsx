import { SYMBOL_HIT_ROLE, type SymbolHit } from 'repotron-domain'

import { SYMBOL_TRACE_TEXT } from './symbol-trace.constants'

type SymbolTraceListProps = {
  hits: SymbolHit[]
}

export function SymbolTraceList({ hits }: SymbolTraceListProps) {
  if (hits.length === 0) return <p className="px-1 text-[13px] text-mute">{SYMBOL_TRACE_TEXT.EMPTY}</p>

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/70">
      {hits.map((hit) => (
        <li key={`${hit.role}-${hit.path}-${hit.startLine}`}>
          <a
            href={hit.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-baseline justify-between gap-4 px-4 py-3 text-[15px] text-ink hover:bg-surface"
          >
            <span>
              <span className="mr-2 text-[12px] font-semibold tracking-wide text-mute uppercase">
                {hit.role === SYMBOL_HIT_ROLE.definition ? SYMBOL_TRACE_TEXT.DEFINITION : SYMBOL_TRACE_TEXT.USAGE}
              </span>
              {hit.path}
            </span>
            <span className="shrink-0 font-mono text-[12px] text-mute">
              {hit.startLine}-{hit.endLine}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

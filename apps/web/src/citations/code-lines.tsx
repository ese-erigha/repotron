import { dedentCode } from './dedent-code'

type CodeLinesProps = {
  content: string
  /** The line of the file where the chunk starts. */
  startLine: number
}

/** The code of a chunk with the line numbers of its file. A long line scrolls sideways. */
export function CodeLines({ content, startLine }: CodeLinesProps) {
  const code = dedentCode(content)
  const lineCount = code.split('\n').length
  const numbers = Array.from({ length: lineCount }, (_, position) => startLine + position).join('\n')

  return (
    <div className="thin-scrollbar flex max-h-60 overflow-auto rounded-xl border border-line bg-sunken font-mono text-[12.5px] leading-[1.7]">
      <pre
        aria-hidden
        className="sticky left-0 shrink-0 select-none border-r border-line bg-sunken py-3 pr-2.5 pl-3 text-right text-faint tabular-nums"
      >
        {numbers}
      </pre>
      <pre className="py-3 pr-4 pl-3 text-ink-soft">
        <code>{code}</code>
      </pre>
    </div>
  )
}

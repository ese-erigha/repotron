import { ANSWER_RULES, NOT_FOUND_ANSWER, sectionsFor, type Preset } from 'repotron-domain'

export type PromptChunk = {
  number: number
  path: string
  startLine: number
  endLine: number
  kind: string
  symbol: string | null
  content: string
}

export function buildPrompt(input: {
  question: string
  chunks: PromptChunk[]
  preset: Preset | null
  paths: string[]
}): { system: string; user: string } {
  const sections = input.preset ? [`Use these sections: ${sectionsFor(input.preset).join(', ')}.`] : []
  const files = input.paths.length > 0 ? [`Indexed files:\n${input.paths.join('\n')}`] : []
  const system = [...ANSWER_RULES, ...sections, ...files].join('\n')
  const chunks = input.chunks.map(renderChunk).join('\n')
  return { system, user: `${input.question}\n\n${chunks}` }
}

export function renderChunk(chunk: PromptChunk): string {
  const symbol = chunk.symbol ? ` ${chunk.symbol}` : ''
  const header = `[${chunk.number}] ${chunk.path}:${chunk.startLine}-${chunk.endLine} (${chunk.kind}${symbol})`
  return `${header}\n<chunk>\n${chunk.content}\n</chunk>`
}

export { NOT_FOUND_ANSWER }

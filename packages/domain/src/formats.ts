export function formatQueryInput(question: string): string {
  return question
}

export function formatChunkInput(header: string, content: string): string {
  return `title: ${header} | text: ${content}`
}

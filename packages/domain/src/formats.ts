export function formatQueryInput(question: string): string {
  return `task: search result | query: ${question}`
}

export function formatChunkInput(header: string, content: string): string {
  return `title: ${header} | text: ${content}`
}

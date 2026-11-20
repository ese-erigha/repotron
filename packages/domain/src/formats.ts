export function formatQueryInput(question: string): string {
  return question
}

export function formatChunkInput(header: string, content: string): string {
  const note = embeddingNote(content)
  if (note === '') return `${header}\n${content}`
  return `${header}\n${note}\n${content}`
}

function embeddingNote(content: string): string {
  const docstring = firstDocstring(content)
  if (docstring !== '') return docstring
  return signatureBeforeContent(content)
}

function firstDocstring(content: string): string {
  const match = /"""([\s\S]*?)"""|'''([\s\S]*?)'''|\/\*\*([\s\S]*?)\*\//.exec(content)
  const raw = match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
  const text = raw.replace(/^\s*\*\s?/gm, '').trim()
  return text.split(/\n\s*\n/)[0]?.trim() ?? ''
}

function signatureBeforeContent(content: string): string {
  const line = content.split('\n').find((item) => item.trim() !== '') ?? ''
  const signature = line.trim()
  if (signature === '' || content.startsWith(line) || content.startsWith(signature)) return ''
  return signature
}

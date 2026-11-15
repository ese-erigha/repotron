const INDENT = /^[ \t]*/

/**
 * Removes the indent that every line of a chunk shares.
 * A method keeps the indent of its class in the index, and that space is wasted in a narrow panel.
 */
export function dedentCode(content: string): string {
  const lines = content.split('\n')
  const indents = lines.filter((line) => line.trim() !== '').map((line) => INDENT.exec(line)?.[0].length ?? 0)
  const shared = indents.length === 0 ? 0 : Math.min(...indents)
  if (shared === 0) return content
  return lines.map((line) => line.slice(Math.min(shared, line.length))).join('\n')
}

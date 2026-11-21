const API_BASE = '/api/v1'

export const INDEX_PATH = {
  LIST: `${API_BASE}/indexes`,
  byId: (indexId: string) => `${API_BASE}/indexes/${encodeURIComponent(indexId)}`,
  questions: (indexId: string) => `${API_BASE}/indexes/${encodeURIComponent(indexId)}/questions`,
  symbol: (indexId: string, name: string) =>
    `${API_BASE}/indexes/${encodeURIComponent(indexId)}/symbols/${encodeURIComponent(name)}`,
} as const

export const QUESTION_PATH = {
  byId: (questionId: string) => `${API_BASE}/questions/${encodeURIComponent(questionId)}`,
} as const

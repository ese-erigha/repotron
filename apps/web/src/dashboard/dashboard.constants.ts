export const DASHBOARD_TEXT = {
  TITLE: 'Scores',
  LEAD: 'Recall, retrieval speed, and cost for each saved version.',
  EMPTY_TITLE: 'No scores yet',
  EMPTY_BODY: 'Scores appear here after a check on develop passes.',
  NEWEST: 'Newest run',
  RECALL: 'Recall',
  PRECISION: 'Precision',
  FAITHFULNESS: 'Faithfulness',
  ANSWER_RELEVANCE: 'Answer relevance',
  CITATION_ACCURACY: 'Citation accuracy',
  REFUSAL_ACCURACY: 'Refusal accuracy',
  FIRST_CHUNK: 'First chunk hit',
  RETRIEVAL: 'Retrieval',
  COST: 'Cost',
} as const

export const SCORE_ROW = {
  recall: DASHBOARD_TEXT.RECALL,
  precision: DASHBOARD_TEXT.PRECISION,
  faithfulness: DASHBOARD_TEXT.FAITHFULNESS,
  answerRelevance: DASHBOARD_TEXT.ANSWER_RELEVANCE,
  citationAccuracy: DASHBOARD_TEXT.CITATION_ACCURACY,
  refusalAccuracy: DASHBOARD_TEXT.REFUSAL_ACCURACY,
  identifierHitAt1: DASHBOARD_TEXT.FIRST_CHUNK,
} as const

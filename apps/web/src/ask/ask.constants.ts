export const ASK_TEXT = {
  QUESTION_LABEL: 'Ask a question about this repository',
  PLACEHOLDER: 'Ask about a function, a file, or a flow',
  SUBMIT: 'Ask',
  SUBMIT_HINT: 'Enter to ask',
  PRESET_START_HERE: 'Where do I start?',
  PRESET_EXPLAIN_FEATURE: 'Explain a feature',
  SUGGESTIONS_TITLE: 'Try a question',
  FEATURE_DIALOG_TITLE: 'Explain a feature',
  FEATURE_DIALOG_TEXT: 'Repotron explains what the feature does, its flow, its key files, and its edge cases.',
  FEATURE_NAME_LABEL: 'Feature name',
  FEATURE_NAME_PLACEHOLDER: 'CORS',
  FEATURE_CANCEL: 'Cancel',
  FEATURE_SUBMIT: 'Explain',
  ANSWER_TITLE: 'Answer',
  SEARCHING: 'Searching the index',
  READING: 'Reading the sources',
  WRITING: 'Writing',
  ANSWERED_IN: 'Answered in',
  SHARE: 'Share',
  SHARE_COPIED: 'Link copied. Anyone with this link can read this answer.',
  SHARE_FAILED: 'Copy this link. Anyone with it can read this answer.',
  SOURCE: 'Source',
  RETRY: 'Try again',
  DISCLAIMER: 'Repotron answers only from the indexed code. Check each citation.',
} as const

/** Starter questions that fit every repository. */
export const QUESTION_SUGGESTIONS = [
  'Where is the entry point of this project?',
  'How does this project handle errors?',
] as const

/** The counter turns to the warning color when this share of the limit is used. */
export const QUESTION_WARNING_SHARE = 0.9

/** The widths of the placeholder lines while the answer loads, as Tailwind classes. */
export const ANSWER_SKELETON_WIDTHS = ['w-11/12', 'w-full', 'w-4/5', 'w-2/3'] as const

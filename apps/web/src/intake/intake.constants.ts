import { REPOSITORY_MAX_KILOBYTES } from 'repotron-domain'

const KILOBYTES_PER_MEGABYTE = 1_024

export const INTAKE_TEXT = {
  BADGE: 'Every answer cites its source',
  TITLE: 'Ask any GitHub repository.',
  TITLE_ACCENT: 'Check every claim.',
  SUBTITLE:
    'Paste the link of a public repository. Repotron indexes the code at one commit, then answers with the file and the lines for each claim.',
  LINK_LABEL: 'Repository link',
  LINK_PLACEHOLDER: 'github.com/owner/repository',
  LINK_HINT: `Public repositories up to ${REPOSITORY_MAX_KILOBYTES / KILOBYTES_PER_MEGABYTE} MB`,
  INVALID_LINK: 'Enter the link of a GitHub repository, such as https://github.com/owner/repository',
  SUBMIT: 'Index',
  STARTED_TITLE: 'In this browser',
  RECENT_TITLE: 'Recently indexed',
  RECENT_EMPTY: 'No repository is indexed yet.',
  RECENT_FAILED: 'The recent list could not load.',
  FILES: 'files',
  START_TITLE: 'Index this repository to ask about it.',
  START_DESCRIPTION:
    'Repotron reads the head commit of the default branch. A large repository takes a few minutes.',
  START_SUBMIT: 'Index this repository',
  STEPS_TITLE: 'How it works',
} as const

export const INTAKE_STEPS = [
  {
    title: 'Paste a link',
    text: 'Use the link of any public repository on GitHub.',
  },
  {
    title: 'Repotron indexes the code',
    text: 'Each function and each class stays whole, at one fixed commit.',
  },
  {
    title: 'Ask, then check',
    text: 'Each claim links to its file and its lines on GitHub.',
  },
] as const

/** The count of placeholder cards while the recent list loads. */
export const RECENT_SKELETON_COUNT = 4

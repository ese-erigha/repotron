const GITHUB_HOST = 'github.com'
const SECURE_SCHEME = 'https://'

/** `owner/repository`, with no host. */
const SHORT_FORM = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/** `http://`, `https://`, and `www.` before the host, in any letter case. */
const HOST_PREFIX = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i

/**
 * Completes a link that a person types by hand: `owner/repo`, `github.com/owner/repo`, or an `http` link.
 * The result still goes through `parseRepositoryLink`, so a wrong link stays wrong.
 */
export function normalizeRepositoryLink(value: string): string {
  const link = value.trim()
  if (SHORT_FORM.test(link)) return `${SECURE_SCHEME}${GITHUB_HOST}/${link}`
  return link.replace(HOST_PREFIX, `${SECURE_SCHEME}${GITHUB_HOST}/`)
}

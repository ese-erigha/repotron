const GITHUB_ORIGIN = 'https://github.com'

const AVATAR_PIXELS = 96

/** The link that the user pastes on the home screen. */
export function githubRepositoryUrl(owner: string, name: string): string {
  return `${GITHUB_ORIGIN}/${owner}/${name}`
}

/** The file tree at one commit. The link uses the sha, not a branch name. */
export function githubCommitTreeUrl(owner: string, name: string, commitSha: string): string {
  return `${githubRepositoryUrl(owner, name)}/tree/${commitSha}`
}

/** The picture of a user or an organization. GitHub serves it at this public path. */
export function githubAvatarUrl(owner: string): string {
  return `${GITHUB_ORIGIN}/${encodeURIComponent(owner)}.png?size=${AVATAR_PIXELS}`
}

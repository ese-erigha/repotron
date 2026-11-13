# Future Works: Repotron

This file lists work after the first demo. [prd.md](prd.md) owns the current behavior.

---

## 1. Index a branch of the same repository

### 1.1 Today

The demo indexes one branch: the default branch that GitHub reports for the repository. For most repositories, that branch is `main` or `master`.

### 1.2 Goal

The user picks a branch of the same repository and asks questions about that branch.

### 1.3 User flow

1. The user pastes a repository link, or a branch link such as `https://github.com/<owner>/<repo>/tree/<branch>`.
2. A branch picker lists the branches from `GET /repos/{owner}/{repo}/branches`. The default branch is first.
3. Repotron resolves the branch to its head commit.
4. When an index for that commit exists, the ask screen opens at once. Otherwise, the index job runs.
5. The ask screen shows the branch name and the short commit sha.

### 1.4 Design

The current design keys an index by repository and commit, not by branch. So a branch needs no new index format.

- **Shared index.** Two branches at the same commit use one index.
- **New table.** `branches` maps a branch to its index:
  - repository id, branch name, head sha, index id, checked time
- **New commit on a branch.** The branch gets a new index. The old index stays readable until the new one is ready.
- **Delete rule.** Delete an old index only when no branch row points to it. The 30-day cleanup still applies.
- **Citations.** Each link already uses the commit sha, so a citation stays correct after the branch moves.
- **Limit.** Set a limit of indexed branches for each repository. Each branch can cost one index job. The starting value is 5.

### 1.5 Reuse unchanged files

Branches of one repository share most of their files. A later step can skip work for a file that did not change.

- The indexer records the git blob sha of each file. The GitHub tree API returns it.
- A file with a known blob sha copies its chunks and vectors from the earlier index. It needs no parse and no embedding.
- Measure the saved time and cost on staging before this step ships.

### 1.6 Out of scope for this work

- A question across two branches
- A diff between two branches
- Tags and single commits. Add them after branches work, with the same resolve step.

---
name: pr-from-develop
description: >-
  Moves uncommitted work off develop onto a new branch and opens a pull
  request into develop. Use when the user invokes this skill, or asks to
  turn the uncommitted changes on develop into a pull request.
disable-model-invocation: true
---

# Pull request from uncommitted work on develop

Move the uncommitted files off `develop`, commit them on a new branch, and open one pull request. The base branch is `develop`. Do not commit on `develop`.

## Stop

- The current branch is not `develop`. Say the branch name and stop.
- `git status --short` is empty. Say that `develop` has no uncommitted files and stop.
- After `git fetch origin develop`, `HEAD` is not `origin/develop`. Say that `develop` has local commits and stop. Do not move those commits.
- A local branch with the chosen name already exists. Say the name. Do not reset it and do not delete it.
- A path is `.env`, `.env.var`, a credential file, or another secret. Leave that file unstaged, warn the user, and stop when every changed file is a secret.

## Branch

Use the branch name the user gave. When they gave none, take a short kebab-case name from the uncommitted diff. Do not invent a second name.

From the repository root:

```bash
git fetch origin develop
git checkout -b BRANCH_NAME
```

Replace `BRANCH_NAME` with that name. The uncommitted files stay in the working tree. Do not stash them. Do not use `git checkout -B`, `reset`, or `--force`.

## Commit

1. Run `git diff` and `git diff --cached`.
2. Run `git log -8 --oneline` and match that subject style.
3. Stage the files that belong to the work.
4. Commit with a message passed through a heredoc. The subject states why.
5. Do not use `--no-verify`, `--amend`, or a git config change.
6. When the hook fails, fix the failure and make a new commit.

## Pull request

```bash
git push -u origin HEAD
```

Do not use `--force`. Allow the command to reach GitHub.

Write the title in the same style as `git log`. Write the body in this shape. The summary is one to three bullets. The test plan is a checklist. Base both on the diff against `origin/develop`.

```bash
gh pr create --base develop --title "TITLE" --body "$(cat <<'EOF'
## Summary
- 

## Test plan
- [ ] 

EOF
)"
```

When a pull request for this branch already exists, run `gh pr view --json url --jq .url` and return that URL. Do not open a second one.

## Report

Return the pull request URL. State the new branch name and that the base branch is `develop`.

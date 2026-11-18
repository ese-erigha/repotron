---
name: create-pull-request
description: >-
  Opens a GitHub pull request into develop with a summary and a test plan.
  Use when the user asks to create, open, or make a pull request, or to put
  the branch up for review against develop.
---

# Open a pull request into develop

Push the current branch and open one pull request. The base branch is `develop`. This skill does not create the branch. When the current branch is `develop` or `main`, stop and tell the user to create a branch first.

## Inspect

Run these commands in parallel from the repository root:

- `git status --short`
- `git diff` and `git diff --cached`
- `git branch -vv`
- `git log --oneline origin/develop..HEAD`
- `git diff origin/develop...HEAD`

Read every commit in that log, not only the latest. The title and the body must match the full range.

## Commit

When `git status --short` is empty, skip this section.

When it is not empty, commit the files that belong to the work. Do not commit `.env`, `.env.var`, credentials, or any other secret. Warn the user when they named one of those files.

1. Run `git log -8 --oneline` and match that subject style.
2. Stage the relevant files.
3. Commit with a message passed through a heredoc. The subject states why.
4. Do not use `--no-verify`, `--amend`, or a git config change.
5. When the hook fails, fix the failure and make a new commit.

## Push

Do not push when the current branch is `develop` or `main`.

```bash
git push -u origin HEAD
```

Do not use `--force`. Allow the command to reach GitHub.

## Description

Write the title in the same style as `git log`. One subject line.

Write the body in this shape. The summary is one to three bullets. Each bullet states why the change exists. The test plan is a checklist a reviewer can run. Base both on the commits and the diff against `origin/develop`.

```markdown
## Summary
- 

## Test plan
- [ ] 
```

## Open

When a pull request for this branch already exists, run `gh pr view --json url --jq .url` and return that URL. Do not open a second one.

```bash
gh pr create --base develop --title "TITLE" --body "$(cat <<'EOF'
## Summary
- 

## Test plan
- [ ] 

EOF
)"
```

Replace `TITLE` and the body with the text from the section above. Allow the command to reach GitHub.

## Report

Return the pull request URL. State that the base branch is `develop`.

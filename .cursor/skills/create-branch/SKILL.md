---
name: create-branch
description: >-
  Creates a local git branch from origin/develop. Use when the user asks to
  create, start, or cut a branch, or to branch off develop.
---

# Create a branch from develop

Create one local branch. The start point is `origin/develop`. This skill does not commit, push, or open a pull request.

## Name

Use the branch name the user gave. When they gave none, take a short kebab-case name from the task they described. Do not invent a second name.

## Run

From the repository root, in this order:

1. Run `git status --short`.
2. Run `git fetch origin develop`.
3. Create the branch:

```bash
git checkout -b BRANCH_NAME origin/develop
```

Replace `BRANCH_NAME` with the name from the section above.

## Stop

- The current branch is `develop` or `main` and the user did not ask for a new branch name. Ask for the name. Do not commit on `develop`.
- A local branch with that name already exists. Say the name. Do not reset it and do not delete it.
- `git status --short` is not empty, and the user did not say those changes belong on the new branch. List the paths. Do not stash and do not discard.
- The user said the current changes belong on the new branch, and the checkout fails because files differ from `origin/develop`. Stash, run the checkout command again, then run `git stash pop`. When the pop conflicts, stop and name the files.

## Forbidden

- Do not branch from `main`, from `HEAD`, or from the current branch.
- Do not push.
- Do not commit.
- Do not update the git config.
- Do not use `git checkout -B`, `reset`, or `--force`.

## Report

State the new branch name and that it starts at `origin/develop`.

---
description: Test, commit, open a PR and merge the current work into main
argument-hint: "[commit message]"
---

Ship the current working-tree changes to `main` on GitHub.

1. Run `npm test`. If anything fails, stop and show the failures — do not ship.
2. Run `git status --porcelain`. If there is nothing to commit and the current branch has no commits ahead of `origin/main`, say so and stop.
3. Review `git diff` (staged and unstaged) and make sure no secrets, `.env` files or `*.db` files are included.
4. Commit message: use `$ARGUMENTS` if provided; otherwise write a concise conventional-commit message (`feat:`, `fix:`, `chore:` …) summarizing the diff.
5. If on `main`, create a branch named `ship/<short-kebab-summary>` first. Stage the relevant files by name and commit.
6. `git push -u origin <branch>`, then `gh pr create --base main --fill` (use the commit message as title; add a short bullet summary to the body).
7. Merge it: `gh pr merge --squash --delete-branch`. If merging is blocked (checks, reviews), report the PR URL and the blocker and stop.
8. `git checkout main && git pull --ff-only`, then report the PR URL and the new `main` commit hash.

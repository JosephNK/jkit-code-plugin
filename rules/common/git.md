# Git & GitHub Guide

## Commit

Always use the `/commit` command when committing.

```bash
# Auto-generate commit message from changes
/commit

# Specify commit message directly
/commit Add login form validation

# Auto mode: generate and commit without confirmation (for automation pipelines)
/commit --auto
/commit --auto 로그인 폼 검증 추가
```

- `/commit` analyzes changes and suggests 3 commit messages
- Does not commit until the user selects one
- `--auto` skips confirmation and commits immediately with the best message
- Commit messages are written in Korean by default, following conventional commit format

### Commit Types

| Type       | Description              |
| ---------- | ------------------------ |
| `feat`     | New feature              |
| `fix`      | Bug fix                  |
| `refactor` | Refactoring              |
| `perf`     | Performance improvement  |
| `docs`     | Documentation change     |
| `test`     | Add/modify tests         |
| `chore`    | Build, config, deps, etc |

## Branch

```bash
# Feature branch
git checkout -b feat/<feature-name>

# Bug fix branch
git checkout -b fix/<bug-name>
```

## Pull Request

```bash
# Create PR
gh pr create --title "title" --body "description"

# List PRs
gh pr list

# View PR status
gh pr view <number>
```

## Common Commands

```bash
# Check status
git status
git log --oneline -10

# View changes
git diff
git diff --cached

# Discard changes
git restore <file>          # discard unstaged changes
git restore --staged <file>  # unstage
```

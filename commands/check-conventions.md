---
description: Verify that current changes comply with project conventions
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(wc:*), Read, Grep, Glob, Agent
---

## Target

Check convention violations against changed files in the current branch.

Changed files: !`git diff --name-only HEAD~1 2>/dev/null || git diff --cached --name-only`

## Rules

**Read `CONVENTIONS.md` first**, then verify ALL rules against the changed files only.

## Output Format

```
## Convention Check Results

### Violations
- [ ] file:line — description

### Warnings (recommendations)
- [ ] file — description

### Passed
"No violations found" if all checks pass
```

If violations are found, ask the user whether to fix them.

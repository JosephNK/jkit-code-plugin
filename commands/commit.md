---
description: Git commit (auto-generate message, always confirm before committing)
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*)
argument-hint: '[--auto] ["commit message" (optional)]'
---

## Current State

- Git status: !`git status`
- Staged changes: !`git diff --cached`
- Unstaged changes: !`git diff`
- Recent commits: !`git log --oneline -5`

## Arguments

**$ARGUMENTS**

## Mode Detection

| Argument | Behavior                                                             |
| -------- | -------------------------------------------------------------------- |
| (none)   | Analyze changes and auto-generate commit message                     |
| text     | Use the provided text as subject, generate body from changes         |
| `--auto` | Auto mode: generate the best message and commit without confirmation |

> `--auto` can be combined with other arguments: `/commit --auto Add login form validation`

---

## Common Rules

1. If there are no changes, do not commit and notify the user
2. Automatically stage all untracked files and unstaged changes without asking
3. **Only ask the user for confirmation on commit message selection**
4. **Never add auto-generated text like "Generated with Claude Code" or "Co-Authored-By" to commit messages**
5. **Do not explain language choice reasoning or decision process. Present commit messages concisely**

## Commit Message Generation Rules

Analyze changes and generate messages in the appropriate language and format.

**CRITICAL: Commit messages MUST be written in English by default. Use Korean ONLY when the user explicitly writes in Korean.**

Language selection based on user input:

- If user message is in English → English
- If user message is in Korean → Korean
- If no input → English (default)

**When no argument is provided:**

```
type: English subject
- English body
```

**When an argument is provided:**

```
type: user input
- English body
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Refactoring
- `perf`: Performance improvement
- `docs`: Documentation changes
- `test`: Add/modify tests
- `chore`: Build, config, dependencies, etc.

**Example: `/commit Update commit command` →**

```
1. chore: Update commit command
   - Add Claude custom commit command
2. feat: Update commit command
   - Add commit command config for Claude Code
3. chore: Update commit command
   - Add .claude/commands directory and commit skill
```

---

## Required Procedure

**If `--auto` flag is present → follow Auto Procedure, otherwise → follow Interactive Procedure.**

---

### Interactive Procedure (default)

#### Step 1: Analyze and Summarize Changes

Show the user:

- List of changed files
- Summary of key changes

#### Step 2: Suggest Commit Messages

**Suggest 3 commit messages:**

1. First suggestion
2. Second suggestion
3. Third suggestion

Guide the user to select 1, 2, or 3, or cancel with 0.

#### Step 3: User Selection (Required)

**Always get user confirmation before committing:**

- Select 1, 2, or 3
- Input 0 or "cancel" to abort the commit

#### Step 4: Execute Commit

- Commit with the user's selected message.
- If cancelled, do not commit and exit.

---

### Auto Procedure (`--auto`)

Commit automatically without user confirmation. Used by automation pipelines (e.g. story-orchestrate).

#### Step 1: Stage & Analyze

1. Stage all changes
2. Analyze the diff

#### Step 2: Generate & Commit

1. Generate **one best commit message** following commit message rules (Korean, type prefix, body)
2. If text argument is provided alongside `--auto`, use it as the subject
3. Commit immediately without confirmation

#### Step 3: Report

- Output the commit hash and message

---

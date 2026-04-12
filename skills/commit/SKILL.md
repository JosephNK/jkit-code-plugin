---
name: commit
description: Git commit with auto-generated message. Analyzes changes and suggests 3 commit messages in Korean.
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*)
disable-model-invocation: true
origin: JKit
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

> `--auto` can be combined with other arguments: `/jkit:commit --auto Add login form validation`

---

## Common Rules

1. If there are no changes, do not commit and notify the user
2. Automatically stage all untracked files and unstaged changes without asking
3. **Only ask the user for confirmation on commit message selection**
4. **Never add auto-generated text like "Generated with Claude Code" or "Co-Authored-By" to commit messages**
5. **Do not explain language choice reasoning or decision process. Present commit messages concisely**

## Commit Message Generation Rules

Analyze changes and generate messages in the appropriate language and format.

**CRITICAL: Commit messages MUST be written in Korean by default. Use English ONLY when the user explicitly writes in English.**

Language selection based on user input:

- If user message is in Korean → Korean
- If user message is in English → English
- If no input → Korean (default)

**When no argument is provided:**

```
type: 한국어 제목
- 한국어 본문
```

**When an argument is provided:**

```
type: 사용자 입력
- 한국어 본문
```

Types:

- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `perf`: 성능 개선
- `docs`: 문서 변경
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정, 의존성 등

**예시: `/jkit:commit 커밋 커맨드 업데이트` 실행 시**

```
1. chore: 커밋 커맨드 업데이트
   - Claude 커스텀 커밋 커맨드 추가
2. feat: 커밋 커맨드 업데이트
   - Claude Code용 커밋 커맨드 설정 추가
3. chore: 커밋 커맨드 업데이트
   - .claude/commands 디렉토리 및 커밋 스킬 추가
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

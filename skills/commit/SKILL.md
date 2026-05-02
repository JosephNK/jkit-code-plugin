---
name: commit
description: Git 커밋 메시지 자동 생성. 변경 사항을 분석하고 한국어 커밋 메시지 3개를 제안한다. MUST be invoked whenever the user expresses intent to commit in Korean or English — including but not limited to "커밋", "커밋 하자", "커밋해", "커밋해줘", "커밋 부탁", "지금 커밋", "이거 커밋", "commit", "commit this", "let's commit", "make a commit", "please commit". Trigger on any user message whose primary intent is to create a git commit, even without the slash command. Do NOT fall back to running raw git commands directly when this skill is available — always invoke this skill first.
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*)
origin: jKit
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

## Subject-case Constraints (commitlint)

`@commitlint/config-conventional`의 `subject-case` 룰이 다음 case를 **금지**합니다. 위반 시 `commit-msg` 훅이 커밋을 차단합니다.

| Case | 예시 | 상태 |
| ---- | ---- | ---- |
| sentence-case | `feat: Add login form` | ❌ |
| start-case | `feat: Add Login Form` | ❌ |
| pascal-case | `feat: AddLoginForm` | ❌ |
| upper-case | `feat: ADD LOGIN FORM` | ❌ |
| lower-case | `feat: add login form` | ✅ |
| 한국어 | `feat: 로그인 화면 추가` | ✅ |

### 적용 규칙

1. **type/scope 뒤 콜론 다음의 subject(첫 줄 본문)** 에만 적용된다. body 라인은 영향 없음.
2. **한국어로 시작하는 subject는 안전**하다 — 한글에는 case 개념이 없음.
3. **subject가 영문으로 시작하면 반드시 lowercase**로 한다. 첫 문자 대문자 금지 (sentence-case 차단됨).
4. **PascalCase 식별자(`UserPromptSubmit`, `BlocProvider` 등)로 subject를 시작하지 않는다**. 한국어 단어로 시작해 식별자는 중간에 배치하거나, 식별자를 백틱으로 감싸 lowercase 단어 뒤에 둔다.
5. 약자(예: `API`, `URL`, `JSON`)도 subject 첫 토큰으로 두면 upper-case 검출 위험이 있으므로 lowercase(`api`, `url`, `json`)로 쓰거나 한국어 단어를 먼저 둔다.

### 안전 패턴

✅ 통과 가능
- `feat: 로그인 화면 추가`
- `fix(api): null 체크 누락 수정`
- `chore(deps): bump axios to 1.7.0`
- `feat: 커밋 의도 감지 UserPromptSubmit 훅 추가` (한국어 시작, 식별자 중간)

❌ 차단됨
- `feat: Add login form` — sentence-case
- `fix: Fix Bug` — start-case
- `feat: UserPromptSubmit 훅 추가` — pascal-case 시작
- `feat: API 응답 처리` — upper-case 시작 (`api 응답 처리`로 수정)
- `chore: NEW FEATURE` — upper-case

### Pre-commit Sanitization (필수)

Step 2(메시지 제안)에서 각 후보를 사용자에게 보여주기 **전에** subject 라인이 위 규칙을 위반하는지 검사한다:

1. subject = `<type>(<scope>):` 뒤 첫 줄 텍스트
2. 만약 첫 토큰이 ASCII 알파벳으로 시작하면, 그 토큰의 첫 문자가 lowercase인지 확인. 아니면 lowercase로 변환하거나 한국어 단어로 시작하도록 재작성.
3. 모든 단어가 대문자로만 구성된 토큰(`API`, `JSON` 등)이 subject 시작 위치에 있으면 lowercase로 변환하거나 한국어 단어를 앞에 배치.
4. PascalCase 식별자가 첫 토큰이면 한국어 단어를 앞에 배치.

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

**Before showing**, validate each subject against the Subject-case Constraints section above. If any candidate would trigger sentence-case / start-case / pascal-case / upper-case, rewrite it (lowercase the leading English token, or move Korean to the front) **before** presenting to the user.

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
3. Validate subject against Subject-case Constraints. If it would trigger sentence/start/pascal/upper-case, rewrite it before committing (this prevents `commit-msg` hook failure).
4. Commit immediately without confirmation

#### Step 3: Report

- Output the commit hash and message

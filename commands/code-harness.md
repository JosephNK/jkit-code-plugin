---
description: TASKS.md + QA.md 기반 Generator↔Evaluator 피드백 루프
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
argument-hint: '<대상 ID> [--once] [--confirm-commit] [--max-rounds N] [task-source] [eval-source]'
---

# Generator↔Evaluator Feedback Loop

> TASKS.md(task-source)와 QA.md(eval-source)를 입력받아 Task 단위 구현-검증을 실행한다.
> Planner 없이 사용자가 직접 작성한 TASKS.md/QA.md를 정본으로 사용한다.
> **1회 실행 = 1라운드**. 루프가 기본 활성 — 여러 라운드를 ScheduleWakeup으로 자율 실행한다. `--once`로 단일 라운드만 실행 가능.

## Architecture

```
  사용자가 직접 작성
  ┌──────────┐  ┌──────────┐
  │ TASKS.md │  │  QA.md   │
  └────┬─────┘  └────┬─────┘
       │              │
       ▼              ▼
  ┌────────────────────────────────────────────┐
  │                                            │
  │   GENERATOR-EVALUATOR FEEDBACK LOOP        │
  │                                            │
  │   ┌───────────────────────┐                │
  │   │ GENERATOR             │──build──┐      │
  │   │ jkit:code-generator    │         │      │
  │   └─────▲─────────────────┘         │      │
  │         │                           ▼      │
  │         │   ┌──────────────────────────┐   │
  │         │   │ Gate 1: 코드 리뷰          │   │
  │         │   │   codex review 우선       │   │
  │         │   │   실패/미설치 시 fallback │   │
  │         │   │   → ecc:{stack}-reviewer │   │
  │         │   │   매핑 없으면 SKIP        │   │
  │         │   └────────────┬─────────────┘   │
  │         │                ▼                 │
  │         │   ┌──────────────────────────┐   │
  │         │   │ Gate 2: 린트 & 빌드        │   │
  │         │   └────────────┬─────────────┘   │
  │         │                ▼                 │
  │      feedback ┌──────────────────────────┐ │
  │         │   │ Gate 3: EVALUATOR         │  │
  │         └───│ jkit:code-evaluator        │  │
  │             └──────────────────────────┘   │
  │                                            │
  │   매 실행 = 1라운드                           │
  │   루프 기본 활성 (ScheduleWakeup 자동 재개)   │
  └────────────────────────────────────────────┘
```

## 상태 디렉토리

모든 라운드 간 정보는 파일로 전달한다. 디렉토리가 없으면 생성한다.

```
code-harness/
├── harness-state/
│   ├── state.json              ← 현재 라운드, Task ID, 상태
│   ├── generator-state.md      ← Generator 구현 결과
│   └── feedback/
│       ├── feedback-001.md     ← Round 1 피드백
│       ├── feedback-002.md     ← Round 2 피드백
│       └── ...
└── reports/
    ├── Task-1.md               ← Task별 리포트
    └── Task-1to5-summary.md    ← 종합 리포트
```

> feedback 파일명 규칙: `feedback-{round}.md`에서 round는 3자리 zero-padding (예: round 1 → `feedback-001.md`)

> 리포트 파일명 규칙: 공백은 하이픈(`-`)으로, `~`는 `to`로 치환한다. 예: `Task 1` → `Task-1.md`, `Task 1~5` → `Task-1to5-summary.md`

### state.json 구조

```json
{
  "taskSource": "code-harness/TASKS.md",
  "evalSource": "code-harness/QA.md",
  "currentTaskId": "Task 1",
  "taskQueue": ["Task 1", "Task 2", "Task 3"],
  "round": 1,
  "maxRounds": 10,
  "loopMode": true,
  "autoCommit": true,
  "status": "initializing",
  "lastUpdated": "2026-04-16T01:00:00Z",
  "lastFailedGate": null,
  "codexAvailable": null,
  "projectStack": null,
  "commitRetryCount": 0,
  "completedTasks": [],
  "currentSlices": null
}
```

> **currentSlices** 구조 (Step 2.5에서 설정):
> ```json
> "currentSlices": {
>   "taskSlice": "code-harness/tasks/Task-1.md",
>   "evalSlice": "code-harness/qa/Task-1.md"
> }
> ```
> 슬라이스 fallback 발생 시에는 원본 경로(`taskSource`/`evalSource`)가 그대로 들어간다. Task 전환 시 `null`로 초기화된다.

#### status 값 정의

| 값 | 의미 | Step 1 라우팅 |
|----|------|---------------|
| `"initializing"` | state.json 생성 직후, Step 3 시작 전 | Step 2 (라운드 패널티 없이 시작) |
| `"in-progress"` | Step 3 실행 중 (Generator/Gate 진행 중) | crash recovery 처리 후 종료 |
| `"pass"` | 현재 Task PASS 완료 | Task 전환 처리 |
| `"fail"` | 현재 라운드 FAIL | round 체크 후 재시도 또는 FAIL 리포트 |
| `"finalizing-pass"` | Step 5 PASS 처리 중 (커밋/리포트) | Step 5 PASS 재개 |
| `"finalizing-fail"` | Step 5 FAIL 처리 중 (롤백/리포트) | Step 5 FAIL 재개 |

## Arguments

**$ARGUMENTS**

| 인자 | 필수 | 설명 |
|------|------|------|
| `대상 ID` | O | Task ID 또는 범위 (예: "Task 1", "Task 1~5") |
| `task-source` | X | Task 정의 + Acceptance Criteria 파일 (기본: `code-harness/TASKS.md`) |
| `eval-source` | X | 테스트 시나리오 + Definition of Done 파일 (기본: `code-harness/QA.md`) |
| `--once` | X | 1라운드만 실행 후 종료 (기본값: 루프 활성 — PASS 또는 maxRounds 도달까지 자동 반복) |
| `--confirm-commit` | X | 커밋 전 사용자 확인 프롬프트 활성화 (기본값: 자동 커밋). 루프 중에도 허용되지만 사용자 부재 시 라운드가 멈출 수 있다 |
| `--max-rounds N` | X | 루프 최대 라운드 수 (기본: 10) |

### 인자 파싱 규칙

1. 첫 번째 인자가 `Task`로 시작하거나 따옴표로 감싸진 경우 → **대상 ID**로 인식, task-source/eval-source는 기본값 사용
2. 인자가 3개 이상이고 첫 번째 인자가 파일 경로(`.md`로 끝남)인 경우 → 순서대로 `task-source`, `eval-source`, `대상 ID`로 파싱 (기존 호환)

### 범위 파싱

`Task N~M` 형식에서 N과 M은 정수. `Task N`, `Task N+1`, ..., `Task M`으로 확장하여 taskQueue에 추가한다. task-source에 해당 Task ID가 없으면 에러를 표시하고 중단한다.

### 예시

```bash
# 기본값 — 루프 + 자동 커밋 (완전 자율 실행)
/jkit:code-harness "Task 1"
/jkit:code-harness "Task 1~5"

# 1라운드만 실행 (자동 커밋)
/jkit:code-harness "Task 1" --once

# 커밋 전 확인 — 루프 중에도 매 커밋 승인 (자리 비움 시 멈출 수 있음)
/jkit:code-harness "Task 1" --confirm-commit

# 1라운드 수동 검수 (디버깅 시)
/jkit:code-harness "Task 1" --once --confirm-commit

# 명시적 — 파일 경로를 직접 지정 (기존 호환)
/jkit:code-harness code-harness/TASKS.md code-harness/QA.md "Task 1"
```

---

## Procedure

### Step 1: 상태 확인

`code-harness/harness-state/state.json`을 읽는다.

#### 상태 파일이 없는 경우 (첫 실행)

**선행 조건 확인** — 아래 규칙에 따라 판정하고, 충족하지 못하면 실행을 **중단**하고 안내 메시지만 출력한다:

- **$ARGUMENTS에 명시적 task-source/eval-source 경로가 포함된 경우** (예: `/jkit:code-harness code-harness/TASKS.md code-harness/QA.md "Task 1"`):
  - 지정된 두 파일이 **실제로 존재**하는지만 확인한다
  - 존재하지 않으면 중단하고 안내한다 (경로 오타/미생성)
  - 존재하면 `code-harness/` 기본 경로 탐색은 건너뛰되, **아래 "선행 조건 충족 이후" 흐름으로 이동**하여 대상 ID 선택 → state.json 생성 단계는 반드시 수행한다 (바로 Step 2로 건너뛰지 않는다)

- **명시적 경로가 없는 경우** (기본 경로 탐색으로 진입):
  - `code-harness/` 디렉토리에 **TASK 키워드 포함 `.md` 파일이 1개 이상** 존재
  - `code-harness/` 디렉토리에 **QA/TEST/EVAL 키워드 포함 `.md` 파일이 1개 이상** 존재
  - 둘 중 하나라도 0개면 중단

안내 메시지 예시:

```
code-harness/TASKS.md 또는 QA.md가 없습니다.

먼저 아래 순서로 스펙 문서를 작성하세요:
  /jkit:code-plan "피처 설명"                     # code-harness/PLAN.md 생성
  /jkit:code-tasks code-harness/PLAN.md            # PLAN.md → TASKS.md 생성
  /jkit:code-qa code-harness/TASKS.md              # TASKS.md → QA.md 생성

파일 생성 후 다시 /jkit:code-harness를 실행하세요.

또는 다른 경로의 파일을 직접 지정:
  /jkit:code-harness <path/to/TASKS.md> <path/to/QA.md> "Task 1"
```

> state.json도 생성하지 않고 즉시 종료한다 (중간 상태로 남지 않도록).

> **PLAN/TASKS 교체 시 주의** — 기능 구현 완료 후 디자인 트랙을 추가하거나 새 PLAN으로 전환할 때는, `/jkit:code-harness` 실행 전 `code-harness/harness-state/`를 **수동으로 삭제**하세요. 이전 라운드의 `state.json`(currentTaskId/taskQueue/completedTasks)이 새 Task ID 세트와 충돌하여 오동작할 수 있습니다.

---

선행 조건을 충족한 경우, 아래 단계로 진행한다. **명시적 경로 케이스·기본 경로 케이스 모두** 이 흐름을 거쳐 state.json 초기화까지 수행한다. $ARGUMENTS가 비어 있거나 부족한 단계에서는 사용자에게 선택형으로 입력받는다.

1. **task-source 결정**
   - 명시적 경로가 있으면 그대로 사용
   - 없으면 `code-harness/` 에서 TASK 키워드 포함 `.md` 파일 탐색 후 번호 목록 표시
2. **eval-source 결정**
   - 명시적 경로가 있으면 그대로 사용
   - 없으면 `code-harness/` 에서 QA, TEST, EVAL 키워드 포함 `.md` 파일 탐색 후 번호 목록 표시
3. **대상 ID 결정** — task-source를 읽어 Task 목록 표시 (범위/개별 선택). 인자로 대상 ID가 주어졌으면 그대로 사용. task-source에 Task 항목이 0개면 위 안내 메시지와 동일하게 실행을 중단한다
4. **옵션 파싱**:
   - `--max-rounds N` (기본 10)
   - `--once` → `loopMode = false` (기본 true)
   - `--confirm-commit` → `autoCommit = false` (기본 true)

> 각 단계에서 반드시 사용자 응답을 기다린다. 사용자 입력 없이 자동으로 진행하지 않는다.

인자 확인 후 state.json을 `status: "initializing"`, `loopMode: {parsed}`, `autoCommit: {parsed}`로 생성하고 Step 2로 진행한다.

`.gitignore`에 아래 항목이 없으면 추가한다:

- `code-harness/harness-state/` — 런타임 상태
- `code-harness/reports/` — 로컬 실행 리포트
- `code-harness/PLAN.md`, `code-harness/TASKS.md`, `code-harness/QA.md` — 작업자별 개인 스펙 문서 (팀원마다 다른 피처/작업을 진행하므로 공유하지 않는다)
- `code-harness/tasks/`, `code-harness/qa/` — TASKS.md/QA.md의 Task 단위 슬라이스 (파생물, code-tasks/code-qa가 자동 생성)

> 팀 공유되는 산출물은 `docs/LEARNED.md` 하나다 (Gate 1 FAIL→PASS 교훈 축적).

#### 상태 파일이 있는 경우 (이어서 실행)

state.json에서 현재 Task, 라운드, 상태를 읽고 아래 분기를 적용한다.

- `status: "initializing"` → Step 2로 (라운드 패널티 없이 재시작)
- `status: "pass"` → **Task 전환 처리 (Step 5에서 미완료 시 crash recovery)**: currentTaskId가 이미 completedTasks에 있으면 전환 완료로 간주하고 건너뛴다. 아니면 currentTaskId를 completedTasks에 추가하고 taskQueue에서 제거한다. `code-harness/harness-state/feedback/` 내 모든 feedback 파일과 `generator-state.md`를 삭제한다. `currentSlices`를 `null`로 초기화한다. taskQueue가 비어있으면 Step 6으로. taskQueue의 첫 번째 항목을 새 currentTaskId로 설정하고, round를 1로 초기화, `commitRetryCount: 0`으로 리셋 후 Step 2로
- `status: "fail"` + `round > maxRounds` → Step 5 (FAIL 리포트)
- `status: "fail"` + `round <= maxRounds` → Step 2로 (스택/codex 캐시 확인 후 Step 3 진행)
- `status: "in-progress"` → 이전 실행이 비정상 종료(crash/timeout)된 것으로 간주. `status: "fail"`, `lastFailedGate: "incomplete"`로 업데이트 (round는 증가하지 않음 — 같은 라운드를 재시도) 후 **종료** — 다음 실행(ScheduleWakeup 또는 수동 재실행)에서 `status: "fail"` 분기로 진입
- `status: "finalizing-pass"` → Step 5 PASS 처리를 재개한다 (이전 실행이 Step 5 PASS 중 crash)
- `status: "finalizing-fail"` → Step 5 FAIL 처리를 재개한다 (이전 실행이 Step 5 FAIL 중 crash)

### Step 2: 프로젝트 스택 감지

`.gitignore`에 `code-harness/harness-state/`, `code-harness/reports/`, `code-harness/PLAN.md`, `code-harness/TASKS.md`, `code-harness/QA.md`, `code-harness/tasks/`, `code-harness/qa/`가 없으면 추가한다 (initializing 재진입 시 누락 방지).

state.json에 `projectStack`과 `codexAvailable`이 이미 설정되어 있으면 (null이 아니면) 재감지를 건너뛰고 Step 3로 진행한다.

프로젝트 루트의 파일로 스택을 판단하고, Gate 2에서 실행할 린트/빌드 명령을 결정한다. 첫 번째 매치를 사용한다. 감지 결과를 state.json의 `projectStack`에 저장한다.

#### Flutter/Dart
- 감지: `pubspec.yaml`
- 명령 (기본): `dart format . && dart analyze`
- **architecture_lint 조건부 추가**: 프로젝트 내 임의의 `pubspec.yaml`의 `dependencies` 또는 `dev_dependencies`에 `architecture_lint` 키가 있으면 명령 뒤에 `&& dart run architecture_lint:lint`를 덧붙인다. 없으면 추가하지 않는다
- 감지 예시 (bash): `grep -q '^\s*architecture_lint:' pubspec.yaml` (entry 디렉토리별 pubspec.yaml도 함께 확인)

#### Node.js/TS/JS
- 감지: `package.json`
- lint: `git add -A && npx lint-staged`
- 중복 검사: `npx jscpd src/`

#### Kotlin/Android
- 감지: `build.gradle.kts` / `build.gradle`
- 명령: `./gradlew ktlintCheck && ./gradlew build`

#### Rust
- 감지: `Cargo.toml`
- 명령: `cargo fmt --check && cargo clippy -- -D warnings && cargo build`

#### Go
- 감지: `go.mod`
- 명령: `gofmt -l . && go vet ./... && go build ./...`

#### Python
- 감지: `pyproject.toml` / `setup.py`
- 명령: `ruff check . && ruff format --check .`

#### Swift
- 감지: `Package.swift`
- 명령: `swift build`

#### C#/.NET
- 감지: `*.csproj` / `*.sln`
- 명령: `dotnet format --verify-no-changes && dotnet build`

#### 그 외
- Gate 2 SKIP

#### codex CLI 감지

`which codex`로 설치 여부를 확인하고, 결과를 state.json의 `codexAvailable`에 저장한다.

Step 2 완료 후 `status: "in-progress"`로 업데이트하고 Step 2.5로 진행한다.

### Step 2.5: Task 슬라이스 확인 및 갱신

Generator/Evaluator에 **TASKS.md/QA.md 전체** 대신 현재 Task에 해당하는 **슬라이스 한 조각**만 전달하여 라운드별 토큰 소비를 줄인다.

#### 2.5-1. 슬라이스 경로 결정

task-source와 eval-source 각각에 대해 슬라이스 디렉토리를 아래 규칙으로 결정한다:

```
slice_dir = <dirname(source)> / <basename(source) lowercase, .md 제거> /
slice_path = slice_dir / <currentTaskId 공백을 '-'로 치환>.md
```

**예시**:
- `code-harness/TASKS.md` + currentTaskId=`Task 1` → `code-harness/tasks/Task-1.md`
- `code-harness/QA.md` + currentTaskId=`Task 1` → `code-harness/qa/Task-1.md`

파일명 sanitize는 리포트 파일과 동일 규칙(공백 → `-`, `~` → `to`)을 따른다.

#### 2.5-2. 슬라이스 stale 감지 및 재생성

각 source에 대해 다음을 수행한다:

1. **슬라이스 파일 존재 확인**: `slice_path`가 없으면 → 재생성 트리거
2. **SHA 비교**: 존재하면 source의 현재 SHA와 슬라이스 첫 줄 주석의 SHA를 비교
   ```bash
   current_sha=$(shasum -a 1 "$source" | awk '{print $1}' | cut -c1-12)
   slice_sha=$(head -1 "$slice_path" | sed -nE 's/.*@ sha ([a-f0-9]+) .*/\1/p')
   [ "$current_sha" = "$slice_sha" ] || TRIGGER_RESLICE=1
   ```
   일치하지 않으면 → 재생성 트리거
3. **재생성**: 트리거되면 slice-tasks.sh를 호출하여 **해당 source 전체를 재슬라이싱**한다 (개별 Task만이 아님 — 다른 Task 슬라이스도 최신화 필요)
   ```bash
   JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
   $JKIT_DIR/scripts/slice-tasks.sh "$source" "$slice_dir"
   ```

#### 2.5-3. 슬라이스 경로 확정 또는 Fallback

재슬라이싱 후에도 `slice_path`가 존재하지 않으면 (예: source 파싱 실패, Task ID 불일치):

- 경고를 `generator-state.md` 최상단에 기록: `슬라이스 없음 — 원본 source를 fallback으로 사용`
- Step 3에서 Generator/Evaluator에 **원본 task-source/eval-source**를 전달 (기존 동작)

슬라이스가 정상 생성되었으면 state.json에 경로를 저장 후 Step 3로 진행한다:

```json
"currentSlices": {
  "taskSlice": "code-harness/tasks/Task-1.md",
  "evalSlice": "code-harness/qa/Task-1.md"
}
```

> **Task 전환 시 (Step 5 PASS 분기)**: state.json의 `currentSlices`를 **초기화**한다 (다음 Task 진입 시 Step 2.5에서 새로 설정됨). 슬라이스 파일 자체는 삭제하지 않는다 — 같은 Task를 재실행하거나 범위 실행에서 재사용 가능.

### Step 3: 현재 라운드 실행

현재 Task에 대해 아래를 순서대로 실행한다.

#### 3-1. Generator 단계

**jkit:code-generator** 에이전트(Agent 도구의 `subagent_type: "jkit:code-generator"`)를 소환하여 Task를 구현한다.

- task-source, eval-source, Task ID를 전달. **task-source/eval-source는 Step 2.5에서 설정한 슬라이스 경로** (`state.currentSlices.taskSlice`, `state.currentSlices.evalSlice`)를 사용한다. Step 2.5에서 슬라이스가 생성되지 않은 경우 (fallback) 원본 경로를 그대로 전달한다.
- Generator는 `code-harness/harness-state/feedback/` 에서 이전 피드백을 읽고, 구현 결과를 `code-harness/harness-state/generator-state.md`에 쓴다

#### 3-2. Gate 1: 코드 리뷰

state.json의 `codexAvailable`에 따라 분기한다:

- **`codexAvailable: true`** — 메인이 직접 `codex review --uncommitted`를 실행한다. 명령이 **실패(exit ≠ 0)**하거나 출력을 파싱할 수 없으면 아래 `codexAvailable: false` 경로와 동일한 fallback을 적용한다 (에러 유형을 구분하지 않고 ecc 리뷰어로 즉시 대체). 실패 상세는 `generator-state.md`의 Gate 1 섹션에 `Gate 1 codex 실패 → fallback 전환: {exit code + 에러 요약 3줄}`로 기록한다
- **`codexAvailable: false`** — `projectStack`에 매핑된 ecc 플러그인의 스택별 리뷰 에이전트를 소환한다 (task-source, eval-source, Task ID 전달). 매핑은 아래 표를 따른다. 매핑된 에이전트가 없거나 ecc 플러그인이 미설치, 또는 ecc 에이전트 호출이 실패하면 Gate 1을 **SKIP**하고 Gate 2로 진행한다. SKIP 사유는 `generator-state.md` Gate 1 섹션에 기록한다

> codex 런타임 실패는 일시적(rate limit·timeout)일 수도 영구적(토큰 초과·설정 오류)일 수도 있으나, 어느 쪽이든 ecc 리뷰어는 로컬 에이전트라 codex 네트워크 이슈와 독립적으로 동작한다. 따라서 에러 유형을 판별하지 않고 즉시 fallback하는 것이 단순하고 안정적이다.

##### Fallback 리뷰 에이전트 매핑

| projectStack | Fallback 에이전트 |
|---|---|
| Flutter/Dart | `ecc:flutter-reviewer` |
| Node.js/TS/JS | `ecc:typescript-reviewer` |
| Kotlin/Android | `ecc:kotlin-reviewer` |
| Rust | `ecc:rust-reviewer` |
| Go | `ecc:go-reviewer` |
| Python | `ecc:python-reviewer` |
| C#/.NET | `ecc:csharp-reviewer` |
| Swift / 그 외 | (매핑 없음 → Gate 1 SKIP) |

##### Fallback 에이전트 출력 해석

ecc 리뷰 에이전트는 `Review Summary` 테이블과 `Verdict: Approve | Warning | Block` 형식으로 응답한다. 아래 규칙으로 codex 판정과 동일하게 정규화한다:

- `Verdict: Approve` → **approve**
- `Verdict: Warning` → `CRITICAL/HIGH`가 0건이면 **approve**(경고 부록), 아니면 **needs-attention**
- `Verdict: Block` → **needs-attention**
- 심각도 정규화: `CRITICAL → critical`, `HIGH → high`, `MEDIUM → medium`, `LOW → low` (소문자)

어느 경로든 결과 판정은 동일하다:
- **approve** → Gate 2로
- **needs-attention (critical/high/medium)** → FAIL 처리 → Step 4로
- **needs-attention (low만)** → `generator-state.md`에 경고 부록으로 기록하고 Gate 2로 진행 (Step 5 리포트의 Gate 1 섹션에 포함)

> **Gate 완료 대기 필수**: 명령이 완전히 완료된 후에만 다음 Gate로 진행한다. 백그라운드로 전환된 명령은 완료 알림을 수신할 때까지 대기한다. 불완전한 중간 출력으로 판정하지 않는다.

> **Gate 1 FAIL 시 LEARNED.md 축적 절차**: codex/ecc 리뷰어 경로 모두 Step 4에서 이슈 단위로 구조화(파일/심볼/토픽/심각도/Automatable/Before 스니펫)하여 저장하므로 Step 5 PASS 경로의 축적 절차와 호환된다. ecc 리뷰어 출력은 메인이 해석하여 동일 필드로 변환한다.

#### 3-3. Gate 2: 린트 & 빌드 (메인이 직접 실행)

Step 2에서 감지한 린트/빌드 명령을 실행한다.

- 성공 → Gate 3로
- 실패 → FAIL 처리 → Step 4로
- Unknown 스택 → Gate 2 SKIP, Gate 3로 진행

#### 3-4. Gate 3: Evaluator 검증

**jkit:code-evaluator** 에이전트(Agent 도구의 `subagent_type: "jkit:code-evaluator"`)를 소환하여 구현을 검증한다.

- task-source, eval-source, Task ID를 전달. **Generator와 동일하게 Step 2.5에서 설정한 슬라이스 경로**를 사용한다 (fallback 시 원본 경로).
- Evaluator는 `code-harness/harness-state/generator-state.md`에서 Generator 결과를 읽고, 검증 결과를 `code-harness/harness-state/feedback/feedback-{round}.md`에 쓴다
- Evaluator는 Write 도구를 갖지만 `code-harness/harness-state/feedback/` 경로에만 쓴다. 프로젝트 코드를 수정하지 않는다

판정 파싱: Evaluator의 판정이 PASS, PASS-WITH-INFRA-BLOCKER, FAIL 중 하나로 명확히 파싱되지 않으면 FAIL로 처리한다. Evaluator가 작성한 `feedback-{round}.md`에 '판정 파싱 불가 — FAIL로 처리' 사유를 append한다 (전체 템플릿을 다시 쓰지 않는다).

판정 (위에서 아래로 우선 평가):
1. **PASS / PASS-WITH-INFRA-BLOCKER** → Step 5 (PASS 리포트)
2. **FAIL** → Step 4

> maxRounds 초과 여부는 Step 1 재진입 시 판정한다. Gate 3 FAIL은 항상 Step 4를 거친다.

### Step 4: FAIL 상태 저장 후 종료

Gate 1~3 중 하나가 FAIL이면:

1. 실패 상세를 `code-harness/harness-state/feedback/feedback-{round}.md`에 쓴다

   **Gate 1/2 실패 시** 메인이 직접 아래 템플릿으로 작성한다:

   ```markdown
   ## 검증 결과: {Task ID} — Round {round}

   ### 판정: FAIL
   ### 실패 Gate: Gate {N}

   ### 에러 내용
   (Gate 명령의 전체 에러 출력을 그대로 붙여넣기)

   ### 수정 제안
   - (에러 메시지 기반 구체적 수정 방향)
   ```

   **Gate 1 FAIL 시 추가 작성 (LEARNED.md 축적 준비)**:

   위 템플릿에 이어 `### 이슈 목록 (구조화)` 섹션을 추가하여 Gate 1 출력(codex review 또는 ecc:{stack}-reviewer 에이전트)을 이슈 단위로 분해한다. 이 섹션은 Step 5 PASS 경로에서 `docs/LEARNED.md` 엔트리 생성에 사용된다.

   > ecc 리뷰어 출력은 카테고리별 섹션(Security/Quality/...)과 `Review Summary` 테이블로 오는데, 메인이 각 Finding 블록을 1이슈로 분해하고 파일·심볼·토픽·Automatable을 Before 스니펫과 함께 Step 4 템플릿에 채워 넣는다.

   각 이슈 블록 템플릿:

   ````markdown
   #### Issue {N}
   - **파일**: `{프로젝트 루트 기준 상대 경로}`
   - **심볼**: `{이름}` ({class|function|method}, 줄 {start}-{end}) — 탐지 실패 시 `null`
   - **토픽**: `{kebab-case-slug}` — 예: `usecase-direct-repository-dependency`
   - **심각도**: `critical` | `high` | `medium` — `low`는 포함하지 않음
   - **Automatable**: `likely` | `unlikely` | `no`
   - **요약**: {Gate 1 피드백을 1-2문장으로 요약}
   - **Before 스니펫**:
     ```{language}
     {함수/클래스 경계 heuristic으로 추출한 코드}
     ```
   ````

   **이슈 분리 규칙**: codex 출력의 번호 매긴 항목(`1.`, `2.`) 또는 bullet 항목 1개 = 1 이슈. ecc 리뷰어 경로는 `[CRITICAL] ...`, `[HIGH] ...` 등 개별 Finding 블록 1개 = 1 이슈. 같은 파일·같은 심볼에 여러 지적이 한 묶음이면 하나의 이슈로 합친다.

   **심볼/경계 탐지 heuristic**:
   - 피드백이 지목한 `파일:줄`에서 시작
   - **중괄호 기반 언어** (Dart/TS/JS/Java/Kotlin/C#/Go/Rust/Swift/C/C++):
     - 위로 올라가며 가장 가까운 `class|interface|enum|function|def|fun` 선언을 찾아 `{`로 여는 줄을 시작점으로
     - 시작점의 중괄호 깊이를 0으로 두고 아래로 이동, 깊이가 다시 0이 되는 닫는 `}`를 종료점으로
   - **들여쓰기 기반 언어** (Python):
     - 위로 올라가며 가장 가까운 `class|def` 선언을 시작점으로
     - 그 줄의 들여쓰기 레벨을 기준으로, 아래로 이동 중 **같거나 더 작은** 들여쓰기를 만나는 직전 줄을 종료점으로
   - 심볼을 탐지하지 못하거나 피드백이 파일:줄을 명시하지 않으면 `심볼: null`로 표기하고 해당 이슈는 LEARNED.md 축적 대상에서 제외한다 (Step 5에서 skip)

   **심각도 매핑**:

   | Gate 1 출력 표현 | LEARNED 심각도 |
   |---|---|
   | Critical / Blocker / CRITICAL | critical |
   | High / Major / HIGH | high |
   | Medium / Minor / MEDIUM | medium |
   | Low / Info / LOW | (축적 제외) |

   > ecc 리뷰어는 `CRITICAL/HIGH/MEDIUM/LOW` 대문자로 방출하므로 소문자로 정규화한 뒤 매핑한다.

   **토픽 명명 규칙**: `{layer-or-context}-{violation}` 형식 소문자 kebab-case.
   - 예: `usecase-direct-repository-dependency`, `domain-layer-framework-import`, `bare-catch-without-logging`, `service-without-dto-validation`

   **Automatable 판정 가이드**:
   - `likely`: 클래스/함수 구조 기반 AST 매칭으로 잡을 수 있는 패턴 (예: 특정 레이어의 금지 import, 특정 이름 규칙 위반)
   - `unlikely`: 의미 분석·데이터 흐름이 필요한 패턴
   - `no`: 린트 룰로 표현 불가 (주관적 네이밍, 문서화 부족 등)

   **Gate 3 실패 시** Evaluator가 이미 feedback 파일을 작성했으므로 파일 쓰기를 건너뛴다.

2. **변경사항은 롤백하지 않는다** — 코드가 남아있어야 다음 라운드 Generator가 피드백을 읽고 해당 에러만 수정할 수 있다
3. state.json 업데이트: `round + 1`, `status: "fail"`, `lastFailedGate: "Gate N"`
4. **이 라운드를 종료한다** — `loopMode === true`(기본값)이면 ScheduleWakeup으로 다음 라운드를 예약한다 (prompt: `/jkit:code-harness`, delaySeconds: 60). `--once` 모드(`loopMode === false`)이면 종료하고 다음 실행 시 새 컨텍스트로 재개

### Step 5: Task 리포트 작성

`code-harness/reports/{TaskID}.md`에 리포트를 작성한다 (파일명은 sanitize 규칙 적용). 디렉토리가 없으면 생성한다.

```markdown
# {TaskID}: {Task 제목}
## Status: PASS / PASS-WITH-INFRA-BLOCKER / FAIL
## Date: {오늘 날짜}
## Rounds: {실행 라운드 수}

---
## 구현 내역
### 변경 파일
- [신규/수정] `파일경로` — 변경 내용 요약

## 검증 결과
### Gate 1: 코드 리뷰 (codex:review 또는 ecc:{stack}-reviewer)
- 리뷰어: codex | ecc:flutter-reviewer | ecc:typescript-reviewer | ... | SKIP
- 판정: PASS / WARNING / FAIL / SKIP

### Gate 2: 린트 & 빌드
- 스택: {projectStack}
- 판정: PASS / FAIL / SKIP

### Gate 3: eval-source 체크리스트
(evaluator 결과를 그대로 옮긴다)

## INFRA-BLOCKER 항목 (있으면)
- (PASS-WITH-INFRA-BLOCKER인 경우 해당 항목 나열)

## Loop 이력
(각 라운드별 기록 — feedback/ 파일들에서 수집)
```

> Rounds 필드 계산:
> - PASS 리포트: `round` 값 (현재 라운드에서 성공)
> - FAIL 리포트 (Step 1 경유, maxRounds 초과): `round - 1` 값 (Step 4에서 이미 round를 증가시켰으므로)
> - FAIL 리포트 (Step 5 커밋 재시도 실패): `round` 값 (Step 4를 경유하지 않아 round가 증가되지 않았음)

#### PASS 리포트인 경우

1. state.json 업데이트: `status: "finalizing-pass"`
2. **LEARNED.md 축적** — Gate 1 FAIL 이력이 있으면 아래 "LEARNED.md 축적 절차"를 수행한다 (없으면 건너뜀)
3. **커밋 진행 판정**:
   - `autoCommit === true`(기본값 — `--confirm-commit` 미지정) → 확인 생략하고 4번으로 즉시 진행한다
   - `autoCommit === false`(`--confirm-commit` 지정) → 아래 정보를 사용자에게 보여주고 `커밋을 진행할까요? [y/N]` 프롬프트로 확인받는다:
     - `git diff --stat`으로 본 변경 파일 요약 (`code-harness/` 제외)
     - 예정된 커밋 메시지 초안
   - 프롬프트 응답 처리:
     - `y / Y` → 4번으로 진행
     - `N` 또는 취소 → `status: "finalizing-pass"` 상태를 **유지한 채로 종료**한다. 사용자는 직접 커밋하거나 `--confirm-commit` 없이 재실행하여 재개할 수 있다 (finalizing-pass 재진입 멱등성으로 안전하게 재개됨). 종료 시 "커밋 보류 — 다음 실행에서 재확인" 메시지로 안내한다
   - **루프 중 사용자 부재 경고**: `loopMode === true`이면서 `autoCommit === false`인 경우, 2번째 라운드 이후 ScheduleWakeup으로 깨어났을 때 사용자가 자리에 없을 수 있다. 프롬프트가 응답을 기다리며 진행이 멈춘다. 완전 자율 실행을 원하면 `--confirm-commit`을 제거하라.
4. 커밋한다. 커밋 시 `code-harness/` 디렉토리는 제외한다 (`docs/LEARNED.md` 변경분은 커밋에 포함). 커밋 규칙은 프로젝트의 `docs/GIT.md`를 참조한다.

> **finalizing-pass 재진입 시 멱등성 보장**: `git log --oneline -1`로 마지막 커밋이 현재 Task의 커밋인지 확인한다. 이미 커밋되었으면 커밋을 건너뛰고 상태 업데이트만 수행한다. 리포트 파일은 덮어쓰기(overwrite)로 작성하여 멱등성을 보장한다. LEARNED.md는 시그니처 기반 dedup으로 재진입 시에도 중복 append되지 않는다.

##### LEARNED.md 축적 절차

1. `code-harness/harness-state/feedback/feedback-*.md` 전체를 round 오름차순으로 스캔한다
2. 각 파일의 `### 이슈 목록 (구조화)` 섹션에서 이슈 튜플을 수집한다. 섹션이 없는 feedback(Gate 2/3 FAIL)은 건너뛴다
3. `심볼: null` 이슈는 축적 대상에서 제외한다
4. `(파일, 심볼, 토픽)` 동일 튜플 중복 시 **최초 round 항목만** 유지한다 (dedup — 한 Task 내 반복 제거)
5. 유효한 각 이슈에 대해:
   - **After 스니펫 추출**: 현재 working tree에서 해당 파일을 읽고 같은 심볼명을 찾아 Step 4와 동일한 heuristic으로 경계 추출. 심볼을 찾지 못하면 이 이슈는 skip하고 Task 리포트의 "LEARNED.md 축적 보류" 섹션에 경고 기록
   - **시그니처 계산** (macOS/Linux 공통 동작):
     ```bash
     echo -n "{stack}:{file}:{symbol}:{topic}" | tr '[:upper:]' '[:lower:]' | shasum -a 1 | cut -c1-6
     ```
   - **기존 엔트리 확인**: `docs/LEARNED.md`에서 `## [{시그니처}]`로 시작하는 줄 검색
     - 있으면 해당 엔트리의 `**Last seen:**` 한 줄만 오늘 날짜 + 현재 Task/Round로 덮어쓴다 (Before/After/원문은 그대로 유지)
     - 없으면 파일 하단에 신규 엔트리를 append한다
6. `docs/LEARNED.md` 파일이 없으면 아래 헤더로 신규 생성한 뒤 엔트리를 append한다. `docs/` 디렉토리가 없으면 먼저 생성한다

##### LEARNED.md 헤더 (최초 생성 시)

```markdown
# Learned Rules

> Gate 1(codex:review 또는 ecc:{stack}-reviewer) FAIL 후 PASS된 교훈을 축적합니다.
> Generator가 매 라운드 이 파일을 읽어 재발을 방지합니다.
> `Automatable: likely` 항목은 `rules/{stack}/custom-lint/` 룰 후보입니다.

---
```

##### LEARNED.md 엔트리 포맷

```markdown
## [{6자리 시그니처}] {topic-slug}
**Stack:** {projectStack}
**Severity:** {critical|high|medium}
**Automatable:** {likely|unlikely|no}
**First seen:** {YYYY-MM-DD} ({Task ID}, round {N})
**Last seen:** {YYYY-MM-DD} ({Task ID}, round {N})
**Symbol:** `{심볼명}` ({타입}) — `{파일 경로}`

### Gate 1 원문 피드백
> {요약 1-2문장}

### Before
(Step 4에서 저장된 FAIL 시점 스니펫 — 언어별 코드 펜스 포함)

### After
(PASS 시점 스니펫 — 현재 working tree에서 추출한 언어별 코드 펜스 포함)

---
```

- **커밋 성공** → `status: "pass"`, `commitRetryCount: 0`으로 업데이트. 이후 **즉시 Task 전환 판단**: currentTaskId를 completedTasks에 추가하고 taskQueue에서 제거한다. taskQueue가 비어있으면 **같은 실행 내에서 Step 6으로 직행**한다 (ScheduleWakeup 없이). taskQueue에 다음 Task가 있으면 feedback 파일과 generator-state.md를 삭제하고, `currentSlices`를 `null`로 초기화하며, 다음 Task로 currentTaskId/round를 초기화한 뒤 종료 — `loopMode === true`(기본값)이면 ScheduleWakeup으로 다음 Task를 예약
- **커밋 실패** (pre-commit 훅 등):
  1. `commitRetryCount`를 state.json에 먼저 증가시킨다
  2. 훅 에러를 `feedback-{round}-commit-retry.md`에 저장 (원래 PASS feedback 보존)
  3. Generator에게 전달하여 수정
  4. **Gate 2(린트/빌드) + Gate 3(Evaluator) 재실행** — Gate 3 실행 시 Evaluator가 `feedback-{round}.md`를 덮어쓰지만, 코드가 변경되었으므로 재평가가 맞다
  5. Gate 통과 시 커밋 재시도, Gate FAIL 시 `commitRetryCount` 증가 후 다시 3번부터 반복 (commitRetryCount는 커밋 실패 또는 재시도 중 Gate 실패 시 모두 증가시킨다)

  > **재시도 시 재확인 금지**: 커밋 재시도는 최초 커밋 시점에 이미 승인(또는 `autoCommit === true` 기본값으로 확인 생략)된 작업이므로 **확인 프롬프트를 다시 띄우지 않는다**.

- **commitRetryCount >= 3** → FAIL 처리, 아래 FAIL 경로 진행

#### FAIL 리포트인 경우

1. state.json 업데이트: `status: "finalizing-fail"`
2. 리포트 작성 (feedback 파일에서 Loop 이력 수집 포함 — 삭제 전에 수집)
3. `git checkout -- . && git clean -fd -e code-harness/`로 변경사항 및 신규 파일 완전 제거 (harness 상태 보존)
4. `code-harness/harness-state/feedback/` 내 모든 feedback 파일 삭제
5. `generator-state.md` 삭제
6. state.json 업데이트: completedTasks에 현재 Task(FAIL) 추가, taskQueue에서 제거, 다음 Task로 이동, round 1로 초기화, `status: "initializing"`, `commitRetryCount: 0`, `currentSlices: null`
7. 다음 Task가 없으면 Step 6으로
8. 종료 — 다음 실행(ScheduleWakeup 또는 수동 재실행)에서 새 Task 시작

> 주의: `git clean -fd`는 `.gitignore`에 포함되지 않은 모든 미추적 파일을 삭제한다. `-e code-harness/`로 harness 디렉토리는 보존하지만, 그 외 미추적 파일(IDE 설정, 로컬 환경 파일 등)은 삭제될 수 있다.

### Step 6: 종합 리포트 (마지막 Task 완료 시)

모든 Task가 완료되었거나 FAIL로 중단된 경우, `code-harness/reports/{대상ID}-summary.md`에 작성한다 (파일명은 sanitize 규칙 적용).

```markdown
# {대상ID} 종합 리포트
## Date: {오늘 날짜}

| Task | Status | Rounds | 비고 |
|------|--------|--------|------|

## 통계
- 총 Task: N개 / PASS: N개 / FAIL: N개
- 총 Loop: N회 (평균 N회/Task)

## FAIL Task 요약 (있으면)
- {TaskID}: {실패 사유 요약}
```

종합 리포트 작성 후 `code-harness/harness-state/` 를 정리(삭제)한다.

> Step 6은 범위/단일 구분 없이 마지막 Task 완료 후 반드시 실행된다. harness-state 정리는 Step 6에서 수행한다. Step 6은 멱등(idempotent)하게 설계되어 있어 중간 crash 후 재실행해도 안전하다. 완료 여부는 `code-harness/reports/` 디렉토리의 종합 리포트 존재 여부로 확인한다.

---

## Rules

1. **1실행 = 1라운드** — code-harness는 1라운드만 실행하고 종료한다. **루프가 기본 활성** — 라운드 종료 후 ScheduleWakeup으로 자동 재개한다. `--once`로 단일 라운드 모드로 전환 가능. 단, Step 5 커밋 실패 재시도(최대 3회)는 같은 실행 내에서 허용
2. **파일로 전달** — 라운드 간 정보는 `code-harness/harness-state/` 의 파일로 주고받는다
3. **순차 실행** — Task는 반드시 하나씩 순서대로 (병렬 금지)
4. **Generator와 Evaluator만 에이전트로 분리** — Gate 1~2는 메인이 직접 실행
5. **FAIL 시 코드 유지** — 상태 저장 후 종료. 변경사항은 롤백하지 않는다 (다음 라운드 Generator가 수정). 최종 FAIL(maxRounds 초과) 시에만 `git checkout -- . && git clean -fd -e code-harness/`로 완전 정리
6. **Gate 판정 존중** — Evaluator의 FAIL을 임의로 PASS로 변경하지 않는다
7. **Evaluator는 매번 새로 소환** — 이전 라운드의 편향을 방지
8. **중단 시에도 리포트 작성** — 완료된 Task까지의 결과를 기록
9. **Gate 완료 대기 필수** — 각 Gate의 명령이 완전히 완료된 후에만 다음으로 진행한다
10. **state.json 갱신 시 lastUpdated 필수** — state.json을 쓸 때마다 `lastUpdated`를 현재 ISO 8601 시각으로 갱신한다
11. **범위 실행 시 FAIL Task는 건너뜀** — maxRounds 초과 FAIL은 리포트 작성 후 다음 Task로 이동. 전체 중단하지 않는다
12. **code-harness/ 보호** — `code-harness/` 하위 전체(`harness-state/`, `reports/`, `PLAN.md`, `TASKS.md`, `QA.md`)는 `.gitignore`에 포함한다. 각 팀원이 자신의 스펙 문서를 자유롭게 작성·수정할 수 있도록 개인화한다. 팀 공유 산출물은 `docs/LEARNED.md` 뿐이다. 커밋 시 `code-harness/` 하위 파일은 staging하지 않는다
13. **Task 전환 시 정리** — Task 이동 시 feedback 파일 전체, generator-state.md를 삭제한다. taskQueue에서 완료 Task를 제거하고 첫 번째 항목을 새 currentTaskId로 설정한다. `currentSlices`를 `null`로 초기화한다 (다음 Task 진입 시 Step 2.5에서 재설정)
14. **Task 슬라이싱 우선 사용** — Generator/Evaluator 호출 시 `state.currentSlices`의 슬라이스 경로(`code-harness/tasks/Task-N.md`, `code-harness/qa/Task-N.md`)를 task-source/eval-source로 전달한다. 슬라이스는 source(`TASKS.md`/`QA.md`)의 SHA가 변경되면 Step 2.5에서 자동 재생성된다. 슬라이싱 실패·미존재 시 원본 source를 fallback으로 전달하고 `generator-state.md`에 경고를 기록한다. 슬라이스 파일은 `code-tasks`/`code-qa`가 생성하므로 harness가 직접 만들지 않는다 (Step 2.5에서 stale 갱신만 수행)

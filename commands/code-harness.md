---
description: TASKS.md + QA.md 기반 Generator↔Evaluator 피드백 루프
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
argument-hint: '<대상 ID> [--loop] [--max-rounds N] [task-source] [eval-source]'
---

# Generator↔Evaluator Feedback Loop

> TASKS.md(task-source)와 QA.md(eval-source)를 입력받아 Task 단위 구현-검증을 실행한다.
> Planner 없이 사용자가 직접 작성한 TASKS.md/QA.md를 정본으로 사용한다.
> **1회 실행 = 1라운드**. `--loop` 옵션 또는 `/loop /code-harness`로 반복한다.

## Architecture

```
  사용자가 직접 작성
  ┌──────────┐  ┌──────────┐
  │ TASKS.md │  │  QA.md   │
  └────┬─────┘  └────┬─────┘
       │              │
       ▼              ▼
  ┌────────────────────────────┐
  │                            │
  │  GENERATOR-EVALUATOR       │
  │     FEEDBACK LOOP          │
  │                            │
  │  ┌───────────┐             │
  │  │ GENERATOR │──build──┐   │
  │  │code-generator agent │   │
  │  └─────▲─────┘         │   │
  │        │               │   │
  │     feedback      Gate 1~3 │
  │        │        (codex,    │
  │  ┌─────┴─────┐  lint,     │
  │  │ EVALUATOR │◀─build)─┘   │
  │  │code-evaluator agent│    │
  │  └───────────┘             │
  │                            │
  │  매 실행 = 1라운드         │
  │  외부 /loop으로 반복       │
  └────────────────────────────┘
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
  "status": "initializing",
  "lastUpdated": "2026-04-16T01:00:00Z",
  "lastFailedGate": null,
  "codexAvailable": null,
  "projectStack": null,
  "commitRetryCount": 0,
  "completedTasks": []
}
```

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
| `--loop` | X | PASS 또는 maxRounds 도달까지 자동 반복 (`/loop /code-harness`와 동일) |
| `--max-rounds N` | X | 루프 최대 라운드 수 (기본: 10) |

### 인자 파싱 규칙

1. 첫 번째 인자가 `Task`로 시작하거나 따옴표로 감싸진 경우 → **대상 ID**로 인식, task-source/eval-source는 기본값 사용
2. 인자가 3개 이상이고 첫 번째 인자가 파일 경로(`.md`로 끝남)인 경우 → 순서대로 `task-source`, `eval-source`, `대상 ID`로 파싱 (기존 호환)

### 범위 파싱

`Task N~M` 형식에서 N과 M은 정수. `Task N`, `Task N+1`, ..., `Task M`으로 확장하여 taskQueue에 추가한다. task-source에 해당 Task ID가 없으면 에러를 표시하고 중단한다.

### 예시

```bash
# 간소화 — 1회 실행
/code-harness "Task 1"

# 간소화 — 자동 반복 (--loop 옵션)
/code-harness "Task 1" --loop
/code-harness "Task 1~5" --loop

# 외부 루프 방식 (--loop과 동일한 효과)
/loop /code-harness "Task 1"

# 명시적 — 파일 경로를 직접 지정 (기존 호환)
/code-harness code-harness/TASKS.md code-harness/QA.md "Task 1" --loop
```

---

## Procedure

### Step 1: 상태 확인

`code-harness/harness-state/state.json`을 읽는다.

#### 상태 파일이 없는 경우 (첫 실행)

$ARGUMENTS가 비어 있거나 부족하면 사용자에게 선택형으로 입력받는다.

1. **task-source 선택** — `code-harness/` 에서 TASK 키워드 포함 `.md` 파일 탐색, 번호 목록 표시
2. **eval-source 선택** — `code-harness/` 에서 QA, TEST, EVAL 키워드 포함 `.md` 파일 탐색
3. **대상 ID 선택** — task-source를 읽어 Task 목록 표시 (범위/개별 선택)
4. **옵션** — max-rounds (기본 10)

> 각 단계에서 반드시 사용자 응답을 기다린다. 사용자 입력 없이 자동으로 진행하지 않는다.

인자 확인 후 state.json을 `status: "initializing"`으로 생성하고 Step 2로 진행한다.

`.gitignore`에 `code-harness/harness-state/`와 `code-harness/reports/`가 없으면 추가한다 (런타임 상태와 리포트는 커밋 대상이 아니다. TASKS.md/QA.md 등 정본 문서는 추적 대상).

#### 상태 파일이 있는 경우 (이어서 실행)

state.json에서 현재 Task, 라운드, 상태를 읽고 아래 분기를 적용한다.

- `status: "initializing"` → Step 2로 (라운드 패널티 없이 재시작)
- `status: "pass"` → **Task 전환 처리 (Step 5에서 미완료 시 crash recovery)**: currentTaskId가 이미 completedTasks에 있으면 전환 완료로 간주하고 건너뛴다. 아니면 currentTaskId를 completedTasks에 추가하고 taskQueue에서 제거한다. `code-harness/harness-state/feedback/` 내 모든 feedback 파일과 `generator-state.md`를 삭제한다. taskQueue가 비어있으면 Step 6으로. taskQueue의 첫 번째 항목을 새 currentTaskId로 설정하고, round를 1로 초기화, `commitRetryCount: 0`으로 리셋 후 Step 2로
- `status: "fail"` + `round > maxRounds` → Step 5 (FAIL 리포트)
- `status: "fail"` + `round <= maxRounds` → Step 2로 (스택/codex 캐시 확인 후 Step 3 진행)
- `status: "in-progress"` → 이전 실행이 비정상 종료(crash/timeout)된 것으로 간주. `status: "fail"`, `lastFailedGate: "incomplete"`로 업데이트 (round는 증가하지 않음 — 같은 라운드를 재시도) 후 **종료** — 다음 `/loop` 실행에서 `status: "fail"` 분기로 진입
- `status: "finalizing-pass"` → Step 5 PASS 처리를 재개한다 (이전 실행이 Step 5 PASS 중 crash)
- `status: "finalizing-fail"` → Step 5 FAIL 처리를 재개한다 (이전 실행이 Step 5 FAIL 중 crash)

### Step 2: 프로젝트 스택 감지

`.gitignore`에 `code-harness/harness-state/`와 `code-harness/reports/`가 없으면 추가한다 (initializing 재진입 시 누락 방지).

state.json에 `projectStack`과 `codexAvailable`이 이미 설정되어 있으면 (null이 아니면) 재감지를 건너뛰고 Step 3로 진행한다.

프로젝트 루트의 파일로 스택을 판단하고, Gate 2에서 실행할 린트/빌드 명령을 결정한다. 첫 번째 매치를 사용한다. 감지 결과를 state.json의 `projectStack`에 저장한다.

#### Flutter/Dart
- 감지: `pubspec.yaml`
- 명령: `dart format . && dart analyze && dart run architecture_lint:lint`

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

Step 2 완료 후 `status: "in-progress"`로 업데이트하고 Step 3으로 진행한다.

### Step 3: 현재 라운드 실행

현재 Task에 대해 아래를 순서대로 실행한다.

#### 3-1. Generator 단계

**code-generator** 에이전트를 소환하여 Task를 구현한다.

- task-source, eval-source, Task ID를 전달
- Generator는 `code-harness/harness-state/feedback/` 에서 이전 피드백을 읽고, 구현 결과를 `code-harness/harness-state/generator-state.md`에 쓴다

#### 3-2. Gate 1: codex:review (메인이 직접 실행)

```
codex review --uncommitted
```

> state.json의 `codexAvailable`이 `false`이면 Gate 1을 SKIP하고 Gate 2로 진행한다.

결과 판정:
- **approve** → Gate 2로
- **needs-attention (critical/high/medium)** → FAIL 처리 → Step 4로
- **needs-attention (low만)** → `generator-state.md`에 경고 부록으로 기록하고 Gate 2로 진행 (Step 5 리포트의 Gate 1 섹션에 포함)

> **Gate 완료 대기 필수**: 명령이 완전히 완료된 후에만 다음 Gate로 진행한다. 백그라운드로 전환된 명령은 완료 알림을 수신할 때까지 대기한다. 불완전한 중간 출력으로 판정하지 않는다.

#### 3-3. Gate 2: 린트 & 빌드 (메인이 직접 실행)

Step 2에서 감지한 린트/빌드 명령을 실행한다.

- 성공 → Gate 3로
- 실패 → FAIL 처리 → Step 4로
- Unknown 스택 → Gate 2 SKIP, Gate 3로 진행

#### 3-4. Gate 3: Evaluator 검증

**code-evaluator** 에이전트를 소환하여 구현을 검증한다.

- task-source, eval-source, Task ID를 전달
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

   **Gate 3 실패 시** Evaluator가 이미 feedback 파일을 작성했으므로 파일 쓰기를 건너뛴다.

2. **변경사항은 롤백하지 않는다** — 코드가 남아있어야 다음 라운드 Generator가 피드백을 읽고 해당 에러만 수정할 수 있다
3. state.json 업데이트: `round + 1`, `status: "fail"`, `lastFailedGate: "Gate N"`
4. **이 라운드를 종료한다** — `--loop` 모드이면 ScheduleWakeup으로 다음 라운드를 예약한다 (prompt: `/code-harness`, delaySeconds: 60). `--loop`이 아니면 종료하고 다음 `/loop` 실행 시 새 컨텍스트로 재개

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
### Gate 1: codex:review (코드 품질)
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
2. 커밋한다. 커밋 시 `code-harness/` 디렉토리는 제외한다. 커밋 규칙은 프로젝트의 `docs/GIT.md`를 참조한다.

> **finalizing-pass 재진입 시 멱등성 보장**: `git log --oneline -1`로 마지막 커밋이 현재 Task의 커밋인지 확인한다. 이미 커밋되었으면 커밋을 건너뛰고 상태 업데이트만 수행한다. 리포트 파일은 덮어쓰기(overwrite)로 작성하여 멱등성을 보장한다.

- **커밋 성공** → `status: "pass"`, `commitRetryCount: 0`으로 업데이트. 이후 **즉시 Task 전환 판단**: currentTaskId를 completedTasks에 추가하고 taskQueue에서 제거한다. taskQueue가 비어있으면 **같은 실행 내에서 Step 6으로 직행**한다 (ScheduleWakeup 없이). taskQueue에 다음 Task가 있으면 feedback 파일과 generator-state.md를 삭제하고, 다음 Task로 currentTaskId/round를 초기화한 뒤 종료 — `--loop`이면 ScheduleWakeup으로 다음 Task를 예약
- **커밋 실패** (pre-commit 훅 등):
  1. `commitRetryCount`를 state.json에 먼저 증가시킨다
  2. 훅 에러를 `feedback-{round}-commit-retry.md`에 저장 (원래 PASS feedback 보존)
  3. Generator에게 전달하여 수정
  4. **Gate 2(린트/빌드) + Gate 3(Evaluator) 재실행** — Gate 3 실행 시 Evaluator가 `feedback-{round}.md`를 덮어쓰지만, 코드가 변경되었으므로 재평가가 맞다
  5. Gate 통과 시 커밋 재시도, Gate FAIL 시 `commitRetryCount` 증가 후 다시 3번부터 반복 (commitRetryCount는 커밋 실패 또는 재시도 중 Gate 실패 시 모두 증가시킨다)
- **commitRetryCount >= 3** → FAIL 처리, 아래 FAIL 경로 진행

#### FAIL 리포트인 경우

1. state.json 업데이트: `status: "finalizing-fail"`
2. 리포트 작성 (feedback 파일에서 Loop 이력 수집 포함 — 삭제 전에 수집)
3. `git checkout -- . && git clean -fd -e code-harness/`로 변경사항 및 신규 파일 완전 제거 (harness 상태 보존)
4. `code-harness/harness-state/feedback/` 내 모든 feedback 파일 삭제
5. `generator-state.md` 삭제
6. state.json 업데이트: completedTasks에 현재 Task(FAIL) 추가, taskQueue에서 제거, 다음 Task로 이동, round 1로 초기화, `status: "initializing"`, `commitRetryCount: 0`
7. 다음 Task가 없으면 Step 6으로
8. 종료 — 다음 `/loop`에서 새 Task 시작

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

1. **1실행 = 1라운드** — code-harness는 1라운드만 실행하고 종료한다. 루프는 `--loop` 옵션 또는 외부(`/loop`)에서 반복. `--loop` 사용 시 라운드 종료 후 ScheduleWakeup으로 자동 재개. 단, Step 5 커밋 실패 재시도(최대 3회)는 같은 실행 내에서 허용
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
12. **code-harness/ 보호** — `code-harness/harness-state/`와 `code-harness/reports/`는 `.gitignore`에 포함한다. TASKS.md/QA.md 등 정본 문서는 git 추적 대상이다. 커밋 시 `code-harness/harness-state/`와 `code-harness/reports/` 파일은 staging하지 않는다
13. **Task 전환 시 정리** — Task 이동 시 feedback 파일 전체, generator-state.md를 삭제한다. taskQueue에서 완료 Task를 제거하고 첫 번째 항목을 새 currentTaskId로 설정한다

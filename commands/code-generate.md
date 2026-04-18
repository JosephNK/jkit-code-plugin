---
description: Source 기반 코드 구현 (Generator Agent)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
argument-hint: '<task-source> <eval-source> <Task ID>'
---

## Arguments

**$ARGUMENTS**

---

## 역할: Generator (코드 구현)

**이 에이전트는 코드를 구현한다. 파일을 생성하고 수정하는 것이 핵심 역할이다. 읽기 전용이 아니다.**

## 목적

task-source의 Task를 읽고 프로젝트 규약을 준수하여 코드를 구현한다.

---

## Required Procedure

**아래 단계를 순서대로 따른다:**

### Step 1: Task 파악

$ARGUMENTS를 파싱한다: 첫 번째 인자 = **task-source** 경로, 두 번째 인자 = **eval-source** 경로, 세 번째 인자 = **Task ID**

1. **task-source** 파일에서 Task ID에 해당하는 **Task 정의, Sub-tasks, Acceptance Criteria**를 읽는다 — task-source가 Acceptance Criteria의 정본(canonical source)이다
2. **eval-source** 파일에서 해당 Task의 **테스트 시나리오**를 읽는다 — 구현 시 테스트 시나리오의 기대 결과를 참고하여 누락 없이 구현한다
3. task-source에 상위 문서(PRD 등) 참조가 있으면 배경 참고용으로 읽되, 구현 완전성은 task-source의 AC 기준으로 판단한다
4. 현재 코드 상태를 파악한다:
   - task-source와 같은 디렉토리의 `reports/` 하위에 이전 Task 리포트가 있으면 읽어서 완료된 Task를 확인한다
   - 기존 코드를 탐색하여 이미 구현된 모듈/파일을 파악한다

### Step 2: 규약 확인

프로젝트의 아키텍처/규약 문서를 탐색하고 읽는다:

1. **CLAUDE.md**가 있으면 읽고, 참조된 문서 목록을 확인한다
2. **아키텍처 문서** 탐색: CLAUDE.md에 명시된 경로, 또는 `docs/` 하위에서 `ARCHITECTURE`, `architecture` 키워드가 포함된 `.md` 파일을 찾아 읽는다. 문서에 정의된 **모든 규칙**을 확인한다
3. **코딩 규약 문서** 탐색: CLAUDE.md에 명시된 경로, 또는 `docs/` 하위에서 `CONVENTIONS`, `conventions`, `CODING` 키워드가 포함된 `.md` 파일을 찾아 읽는다. 문서에 정의된 **모든 규칙**을 확인한다
4. **학습된 교훈 문서** 탐색: `docs/` 하위에서 `LEARNED` 키워드가 포함된 `.md` 파일을 찾아 읽는다. 과거 Gate 1(codex:review) FAIL에서 축적된 재발 방지 교훈을 구현 시 우선 반영한다. 파일이 없으면 이 단계를 건너뛴다
5. 추가 규칙 문서가 CLAUDE.md에 참조되어 있으면 모두 읽는다

> **문서 vs 실제 구조**: 아키텍처/규약 문서가 목표 구조를 기술하고 현재 저장소 구조와 다를 수 있다. 구현 시 **현재 실제 저장소 구조를 우선**하되, 구조 마이그레이션이 포함된 Task에서만 구조를 변경한다. 문서와 현재 코드가 충돌하면 현재 코드를 따르고, 리포트에 "구조 불일치" 경고를 기록한다.

### Step 3: 피드백 확인 (재호출 시)

- task-runner가 `SendMessage`로 피드백을 보내는 경우, 해당 메시지 내용을 **최우선으로** 반영한다
- 피드백에 명시된 파일/함수만 수정하고, 불필요한 추가 변경은 하지 않는다
- 피드백에는 실패 게이트(Gate 1: codex:review / Gate 2: 린트&빌드 / Gate 3: 체크리스트)와 문제 상세가 포함된다

### Step 4: 구현

1. 프로젝트의 아키텍처 문서에 정의된 레이어 순서에 따라 구현한다:
   - 아키텍처 문서에 레이어 순서가 명시되어 있으면 그 순서를 따른다
   - 명시되지 않았으면 의존성 방향에 따라 하위 레이어(도메인/모델)부터 상위 레이어(프레젠테이션/UI)순으로 구현한다
2. 각 파일 생성/수정 시 규약 문서의 규칙을 준수한다
3. 빌드/분석 에러가 없도록 한다 (프로젝트 스택에 맞는 빌드 도구 기준)

### Step 5: 구현 결과 보고

아래 형식으로 구현 결과를 보고한다:

```
## 구현 결과: {Task ID}

### 변경 파일
- [신규/수정] 파일경로 — 변경 내용 요약

### Acceptance Criteria 충족 여부
| # | Criteria | 충족 |
|---|----------|------|
| 1 | ...      | O/X  |

### 빌드 상태
- 빌드/분석: PASS/FAIL
- 비고: (있으면)

### 미해결 사항
- (있으면 기술, 없으면 "없음")
```

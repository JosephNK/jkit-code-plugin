---
description: Source 기반 코드 구현 (Generator)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
argument-hint: '<task-source> <eval-source> <Task ID>'
---

## Arguments

**$ARGUMENTS**

---

## 목적

task-source의 Task를 읽고 프로젝트 규약을 준수하여 코드를 구현한다. (이 커맨드는 코드를 생성/수정한다 — 읽기 전용이 아니다.)

## 절차

### 1. 입력 파싱

`$ARGUMENTS` → task-source, eval-source, Task ID

1. task-source에서 Task 정의, Sub-tasks, AC 읽기 (AC 정본)
2. eval-source에서 해당 Task 테스트 시나리오 읽기
3. 기존 구현 파악: `code-harness/reports/` 이전 리포트 + 기존 모듈

### 2. 규약 확인

- **CLAUDE.md** → 참조 문서 목록 확인
- **아키텍처 문서** — CLAUDE.md 명시 경로 또는 `docs/ARCHITECTURE*.md`
- **코딩 규약 문서** — CLAUDE.md 명시 경로 또는 `docs/CONVENTIONS*.md`, `docs/CODING*.md`
- **`docs/LEARNED.md`** — 과거 FAIL 축적 교훈을 우선 반영 (없으면 건너뜀). `LEARNED-LINT.md`는 읽지 않는다

> **드리프트**: 아키텍처/규약 문서와 기존 코드가 다르면 현재 코드를 우선하고 리포트 `### 미해결 사항`에 기록 (Task 계속 진행).

### 3. 피드백 확인 (재호출 시)

task-runner가 피드백(실패 Gate + 상세)을 전달하면 **최우선**으로 반영하고, 명시된 파일/함수만 수정한다.

### 4. 구현

1. 아키텍처 문서 레이어 순서에 따라 구현
2. **파일 생성 직전 경로 검증** (필수): 각 경로를 아키텍처 레이어 패턴과 매칭. 매칭 실패(특히 **신규 폴더 생성**) 시:
   - PLAN(`code-harness/PLAN.md`)의 `## 아키텍처 변경 필요`에 경로 명시 + "사용자 승인: 승인됨"이면 진행
   - 그 외 → **파일 생성 중단** → Step 5 `### 구조 불일치 경고`에 `STATUS: MISMATCH` + 상세 기록 후 종료. 하네스가 이 마커를 감지해 Task 즉시 FAIL 처리
3. 빌드/분석 에러가 없도록 한다

### 5. 구현 결과 보고

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

### 구조 불일치 경고
STATUS: NONE | MISMATCH   ← 필수. 하네스가 이 줄을 파싱한다.

- `STATUS: NONE` — 경로 검증 통과 또는 PLAN 승인 bypass
- `STATUS: MISMATCH` — 파일 생성 중단됨. 아래 기록:
  - Task가 지시한 경로: {경로}
  - 기대 레이어 패턴: {아키텍처 문서 기준}
  - PLAN 승인 상태: (섹션 없음 | 경로 미명시 | 승인 없음)
  - 불일치 이유: {간단 설명}

### 미해결 사항
- (있으면 기술, 없으면 "없음")
```

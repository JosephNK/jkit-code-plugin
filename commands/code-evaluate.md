---
description: eval-source 기반 구현 검증 (Evaluator Agent)
allowed-tools: Read, Glob, Grep, Bash, Agent
argument-hint: '<task-source> <eval-source> <Task ID>'
---

## Arguments

**$ARGUMENTS**

---

## 목적

eval-source의 테스트 시나리오를 기반으로 Generator가 구현한 코드를 검증한다.
**이 커맨드는 코드를 수정하지 않는다. 읽기 전용으로만 동작한다.**

---

## Required Procedure

**아래 단계를 순서대로 따른다:**

### Step 1: 검증 기준 로드

$ARGUMENTS를 파싱한다: 첫 번째 인자 = **task-source** 경로, 두 번째 인자 = **eval-source** 경로, 세 번째 인자 = **Task ID** (Generator 구현 결과는 task-runner가 prompt에 주입)

1. **task-source** 파일에서 Task ID에 해당하는 **Acceptance Criteria 원문**을 읽는다 — 이것이 AC 충족 판정의 정본이다
2. **eval-source** 파일에서 해당 Task의 **테스트 시나리오**를 읽는다 — AC를 구체적으로 검증하기 위한 시나리오이다
3. eval-source의 **Definition of Done (전체 공통)** 항목을 읽는다 (없으면 아래 Step 4의 기본 DoD 템플릿을 사용)

### Step 2: 규약 준수 검증

프로젝트의 아키텍처/규약 문서를 탐색하고 읽는다:

1. **CLAUDE.md**가 있으면 읽고, 참조된 문서 목록을 확인한다
2. **아키텍처 문서** 탐색: CLAUDE.md에 명시된 경로, 또는 `docs/` 하위에서 `ARCHITECTURE`, `architecture` 키워드가 포함된 `.md` 파일을 찾아 읽는다. 문서에 정의된 **모든 규칙**을 기준으로 위반 여부를 검증한다
3. **코딩 규약 문서** 탐색: CLAUDE.md에 명시된 경로, 또는 `docs/` 하위에서 `CONVENTIONS`, `conventions`, `CODING` 키워드가 포함된 `.md` 파일을 찾아 읽는다. 문서에 정의된 **모든 규칙**을 기준으로 위반 여부를 검증한다
4. 추가 규칙 문서가 CLAUDE.md에 참조되어 있으면 모두 읽고 검증 기준에 포함한다

> 문서의 특정 항목만이 아닌, 문서 전체 내용을 검증 기준으로 사용한다.

> **문서 vs 실제 구조**: 아키텍처/규약 문서가 목표(target) 구조를 기술하고 현재 저장소 구조와 다를 수 있다. 구조 관련 항목(디렉토리 구조, 경로 별칭, 라우팅 패턴 등)은 **현재 실제 저장소 구조를 기준**으로 판정한다. 목표 구조와의 차이는 FAIL이 아닌 **WARNING**으로 기록하고, 규약 준수 표에 비고란에 "구조 마이그레이션 필요"로 명시한다. 구조 마이그레이션이 해당 Task의 Acceptance Criteria에 포함된 경우에만 목표 구조 기준으로 FAIL 판정한다.

### Step 3: 코드 검증

변경된 파일들을 하나씩 읽고 아래 항목을 검증한다:

1. **기능 완전성**: Acceptance Criteria가 모두 구현되었는가?
2. **테스트 시나리오 체크리스트**: 각 검증 항목의 기대 결과가 코드로 충족 가능한가?
3. **누락 검증**: 필요한 파일이 빠지지 않았는가? (아키텍처 문서에 정의된 레이어별 필수 산출물 기준)
4. **보안 검증**: 인증/인가 관련 Task의 경우 미들웨어/가드 적용 여부 확인

> **참고**: 빌드 검증은 task-runner의 Gate 2에서 이미 수행되므로 이 단계에서는 실행하지 않는다.

### Step 4: 검증 결과 보고

아래 형식으로 검증 결과를 보고한다:

```
## 검증 결과: {Task ID}

### 판정: PASS / FAIL

### 테스트 시나리오 체크리스트
| # | 검증 항목 | 유형 | 기대 결과 | 판정 | 비고 |
|---|----------|------|----------|------|------|
| 1 | ...      | ...  | ...      | PASS/FAIL | |

### Definition of Done
| # | 항목 | 판정 | 비고 |
|---|------|------|------|
| 1 | Acceptance Criteria 전항목 충족 | PASS/FAIL | task-source AC + eval-source 시나리오 기준 |
| 2 | 코드 리뷰 완료 | N/A | task-runner Gate 1 codex:review로 대체 |
| 3 | 테스트 작성 및 통과 | PASS/FAIL/INFRA-BLOCKER | 테스트 러너 미구성 시 INFRA-BLOCKER |
| 4 | 린트 & 빌드 에러 없음 | N/A | task-runner Gate 2에서 수행 |

> **DoD 동적 확장**: eval-source에 프로젝트 고유의 Definition of Done 항목이 정의되어 있으면 위 기본 항목에 추가한다. eval-source의 DoD가 위 항목과 중복되면 eval-source의 판정 기준을 우선한다.

### 규약 준수
(아키텍처/규약 문서에서 읽은 규칙들을 기준으로 항목을 동적으로 구성한다)
| 항목 | 판정 | 비고 |
|------|------|------|

> **규약 준수 항목 동적 구성**: 하드코딩된 항목 목록을 사용하지 않는다. Step 2에서 읽은 아키텍처/규약 문서의 규칙들을 항목으로 변환한다. 예를 들어:
> - 아키텍처 문서에 "레이어 간 의존성 방향" 규칙이 있으면 → "레이어 의존성 방향" 항목으로 검증
> - 규약 문서에 "명명 규칙" 섹션이 있으면 → "명명 규칙 준수" 항목으로 검증
> - 규약 문서에 "에러 처리 전략" 섹션이 있으면 → "에러 처리 전략" 항목으로 검증

### FAIL 항목 상세 (FAIL인 경우만)
1. **[항목명]**: 문제 설명
   - 파일: `파일경로:라인번호`
   - 원인: 구체적 원인
   - 수정 제안: 어떻게 수정해야 하는지
```

---

## 판정 기준

- **PASS**: 모든 검증 항목이 PASS 또는 N/A
- **PASS-WITH-INFRA-BLOCKER**: FAIL 항목은 없지만 INFRA-BLOCKER가 1개 이상 존재 (task-runner는 이를 PASS로 취급하고 루프를 종료한다)
- **FAIL**: PASS/N/A/INFRA-BLOCKER가 아닌 FAIL 항목이 하나라도 있으면 → FAIL 항목 상세에 수정 방법을 구체적으로 기술

## 자동화 불가 항목 처리

Definition of Done 중 agent가 직접 판정할 수 없는 항목은 다음 기준으로 대체한다:

| 원본 항목                     | 대체 판정 기준                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 코드 리뷰 완료                | task-runner Gate 1 codex:review로 대체 → **N/A** 처리                                                       |
| 테스트 작성 및 통과           | 프로젝트의 테스트 명령이 있으면 실행하여 판정. **테스트 러너가 미구성이면 `INFRA-BLOCKER`로 판정** (FAIL이 아닌 인프라 미비 표시, 루프를 중단하지 않음) |
| 린트 & 빌드 에러 없음         | task-runner Gate 2에서 수행 → **N/A** 처리                                                                   |

> **테스트 명령 감지**: 프로젝트 스택에 따라 테스트 명령을 자동 감지한다:
> - `pubspec.yaml` → `flutter test` 또는 `dart test`
> - `package.json` (test 스크립트 존재) → `npm test`
> - `Cargo.toml` → `cargo test`
> - `go.mod` → `go test ./...`
> - `pyproject.toml` → `pytest` 또는 `python -m pytest`
> - `build.gradle.kts` → `./gradlew test`
> - 해당 없음 → `INFRA-BLOCKER`

### INFRA-BLOCKER 판정 규칙

`INFRA-BLOCKER`는 코드 품질이 아닌 인프라 미비로 검증 불가한 상태이다:

- PASS/FAIL 판정에서 제외한다 (FAIL로 카운트하지 않는다)
- 리포트에 기록하여 사용자에게 인프라 셋업이 필요함을 알린다
- Generator에게 피드백으로 보내지 않는다 (코드 문제가 아니므로)

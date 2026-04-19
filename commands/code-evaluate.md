---
description: eval-source 기반 구현 검증 (Evaluator)
allowed-tools: Read, Glob, Grep, Bash, Agent
argument-hint: '<task-source> <eval-source> <Task ID>'
---

## Arguments

**$ARGUMENTS**

---

## 목적

eval-source의 테스트 시나리오를 기반으로 Generator 구현을 검증한다. **읽기 전용** — 코드를 수정하지 않는다.

## 절차

### 1. 검증 기준 로드

`$ARGUMENTS` → task-source, eval-source, Task ID (Generator 결과는 task-runner가 prompt에 주입)

1. task-source에서 AC 원문 읽기 (AC 판정 정본)
2. eval-source에서 테스트 시나리오 읽기
3. eval-source의 **Definition of Done (전체 공통)** 읽기 (없으면 Step 4 기본 템플릿 사용)

### 2. 규약 준수 검증

- **CLAUDE.md** → 참조 문서 확인
- **아키텍처 문서** — 정의된 모든 규칙 기준 위반 여부 검증
- **코딩 규약 문서** — 정의된 모든 규칙 기준 위반 여부 검증

> 문서 특정 항목이 아니라 전체 내용을 검증 기준으로 사용한다.

> **구조 드리프트**: 구조 관련 항목은 **현재 실제 구조 기준** 판정. 목표와의 차이는 FAIL이 아닌 **WARNING** (규약 준수 표 비고에 "구조 마이그레이션 필요"). 구조 마이그레이션이 AC에 포함된 경우만 목표 기준 FAIL.

### 3. 코드 검증

1. **기능 완전성** — AC 모두 구현?
2. **테스트 시나리오 체크리스트** — 각 기대 결과가 코드로 충족 가능?
3. **누락 검증** — 아키텍처 문서 기준 필수 산출물 빠짐 없음?
4. **보안 검증** — 인증/인가 관련이면 미들웨어·가드 적용 여부

> 빌드 검증은 task-runner Gate 2에서 수행하므로 여기서는 실행하지 않는다.

### 4. 검증 결과 보고

```
## 검증 결과: {Task ID}

### 판정: PASS / PASS-WITH-INFRA-BLOCKER / FAIL

### 테스트 시나리오 체크리스트
| # | 검증 항목 | 유형 | 기대 결과 | 판정 | 비고 |
|---|----------|------|----------|------|------|

### Definition of Done
| # | 항목 | 판정 | 비고 |
|---|------|------|------|
| 1 | AC 전항목 충족 | PASS/FAIL | task-source AC + eval-source 시나리오 기준 |
| 2 | 코드 리뷰 완료 | N/A | task-runner Gate 1로 대체 |
| 3 | 테스트 작성 및 통과 | PASS/FAIL/INFRA-BLOCKER | 테스트 러너 미구성 시 INFRA-BLOCKER |
| 4 | 린트 & 빌드 에러 없음 | N/A | task-runner Gate 2에서 수행 |

> eval-source에 프로젝트 고유 DoD가 있으면 위 항목에 추가. 중복되면 eval-source 기준 우선.

### 규약 준수
(아키텍처/규약 문서 규칙 기준으로 동적 구성)
| 항목 | 판정 | 비고 |
|------|------|------|

### FAIL 항목 상세 (FAIL인 경우만)
1. **[항목명]**: 문제 설명
   - 파일: `파일경로:라인번호`
   - 원인: 구체적 원인
   - 수정 제안: 어떻게 수정해야 하는지
```

---

## 판정 기준

- **PASS** — 모든 검증 항목이 PASS 또는 N/A
- **PASS-WITH-INFRA-BLOCKER** — FAIL 없지만 INFRA-BLOCKER가 1개 이상 (task-runner는 PASS로 취급하고 루프 종료)
- **FAIL** — FAIL 항목이 하나라도 있음 → 상세에 수정 방법 구체적으로 기술

## 테스트 명령 감지

| 감지 파일 | 명령 |
|-----------|------|
| `pubspec.yaml` | `flutter test` / `dart test` |
| `package.json` (test 스크립트) | `npm test` |
| `Cargo.toml` | `cargo test` |
| `go.mod` | `go test ./...` |
| `pyproject.toml` | `pytest` |
| `build.gradle.kts` | `./gradlew test` |
| 해당 없음 | INFRA-BLOCKER |

## INFRA-BLOCKER

인프라 미비로 검증 불가한 상태 (FAIL 아님).

- PASS/FAIL 판정에서 제외 (FAIL로 카운트 X)
- 리포트에 기록하여 사용자에게 인프라 셋업 필요를 알림
- Generator에게 피드백으로 보내지 않음 (코드 문제 아님)

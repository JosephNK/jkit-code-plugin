# 계획 문서 생성 커맨드

`ecc:plan` 스킬을 래핑하여 요구사항 정리 → 리스크 평가 → 단계별 구현 계획을 수립하고, 결과를 `code-harness/PLAN.md`로 저장합니다.

생성된 `PLAN.md`는 이후 `/code-tasks` 커맨드의 입력으로 사용됩니다.

## 사용법

```
/code-plan <요구사항 또는 설명>
/code-plan 로그인 화면에 2FA 추가
/code-plan 로그인 화면에 2FA 추가 -o code-harness/PLAN.md
```

## 인자

- `$ARGUMENTS` 본문: 계획을 수립할 요구사항/설명 (필수)
- `-o <path>`: 출력 파일 경로 (선택, 기본값: `code-harness/PLAN.md`)

## 사전 조건

이 커맨드는 **`ecc:plan` 스킬에 의존**합니다. `everything-claude-code` 플러그인이 설치되어 있어야 동작합니다.

`ecc:plan` 스킬이 사용 가능한지 확인한 뒤 진행합니다. 사용 불가 시 사용자에게 안내하고 종료합니다.

## 워크플로우

### Step 1: 인자 파싱 및 사전 조건 확인

1. `$ARGUMENTS`에서 `-o <path>` 옵션을 분리하여 `OUTPUT`에 저장 (없으면 `code-harness/PLAN.md`)
2. 나머지 본문을 요구사항 `DESCRIPTION`으로 취급 — 비어 있으면 에러 메시지 출력 후 종료
3. `ecc:plan` 스킬 사용 가능 여부 확인 — 불가 시 "ecc 플러그인 설치 필요" 안내 후 종료

### Step 2: ecc:plan 스킬 호출

Skill 도구로 `ecc:plan`을 호출합니다. `DESCRIPTION` 뒤에 아래 지시 블록을 덧붙여 전달합니다:

```
요구사항을 '기능 트랙'과 '디자인 트랙'으로 나누어 작성해라.

- 기능 트랙 포함 여부(yes/no)를 먼저 명시한다. yes면 비즈니스 로직/API/데이터 모델/상태 흐름을 작성한다. no면 "기존 구현 유지"로 표기한다.
- 디자인 도구를 figma / stitch / none 중 하나로만 선택한다 (혼용 금지).
  - figma 선택: Figma 파일 URL, 화면↔Frame ID 매핑을 작성한다.
  - stitch 선택: Stitch 프롬프트 저장 경로(docs/stitch/*.md)와 화면별 프롬프트 목록을 작성한다.
  - none 선택: 디자인 트랙 전체를 생략 가능.
- 기능 트랙=no 이면서 디자인 도구=none 인 조합은 의미가 없으므로 둘 중 최소 하나는 활성화되어야 한다.
- 디자인 시스템 항목이 필요하면 디자인 토큰 소스와 공통 컴포넌트 목록을 포함한다.
```

ecc:plan은 다음 절차를 수행합니다:
1. 요구사항 재진술
2. 리스크 및 블로커 식별
3. 단계별 구현 계획 작성
4. **사용자 확인 대기** — 확인 없이 다음 단계로 진행 금지

### Step 3: 사용자 확인 대기

ecc:plan이 제시한 계획에 대해 사용자가 명시적으로 승인("yes", "proceed", "좋아" 등)할 때까지 대기합니다.

사용자가 수정 요청("modify: ...")하면 ecc:plan에 해당 요청을 전달하여 계획을 갱신합니다.

사용자가 취소("no", "cancel")하면 파일 저장 없이 종료합니다.

### Step 4: PLAN.md 저장

승인된 계획을 다음 구조로 `OUTPUT` 경로에 저장합니다:

```markdown
# 구현 계획

## 생성일
{오늘 날짜}

## 요구사항
{DESCRIPTION}

## 기능 트랙
### 기능 트랙 포함: yes | no

(yes인 경우만 아래 섹션을 채움. no면 "기존 구현 유지 — 변경 없음"으로 표기)

- 비즈니스 로직 / API / 데이터 모델 / 상태 흐름

## 디자인 트랙
### 디자인 도구: figma | stitch | none

(figma 또는 stitch 선택 시만 아래 섹션을 채움. none이면 디자인 트랙 전체 생략)

### (figma 선택 시) Figma 레퍼런스
- 파일 URL:
- 화면 ↔ Frame ID 매핑:

  | 화면 | Figma Frame ID | 비고 |
  |------|----------------|------|

### (stitch 선택 시) Stitch 프롬프트
- 프롬프트 저장 경로: docs/stitch/{screen}.md
- 화면별 프롬프트 목록:

### 디자인 시스템 (디자인 도구 ≠ none 일 때)
- 디자인 토큰 소스: (Figma Variables / 수동 정의 등)
- 공통 컴포넌트 목록:

## 계획 본문
{ecc:plan이 생성한 전체 계획}
```

**모드 조합 규칙**:
- `기능 트랙 = yes` + `디자인 도구 ≠ none` → 기능 + 디자인 함께
- `기능 트랙 = yes` + `디자인 도구 = none` → 기능만
- `기능 트랙 = no` + `디자인 도구 ≠ none` → 디자인만 (기존 구현에 디자인 입히기)
- `기능 트랙 = no` + `디자인 도구 = none` → **금지** (아무것도 하지 않음). 에러 출력 후 재작성 요청

출력 디렉토리가 없으면 생성합니다.

### Step 5: 완료 보고

- 저장된 파일 경로 출력
- 다음 단계 안내: `/code-tasks {OUTPUT}` 실행으로 Task 문서 생성 가능

## 주의사항

- 커맨드 내부에서 코드 수정을 하지 않습니다. 계획 수립과 문서 저장만 수행합니다.
- ecc:plan의 판정(리스크, 복잡도 등)을 임의로 변경하지 않고 그대로 보존합니다.
- 기존 `OUTPUT` 파일이 있으면 덮어쓰기 전에 사용자에게 확인을 받습니다.
- **디자인 도구 혼용 금지**: figma와 stitch를 동시에 정본으로 두지 않습니다. 예외적으로 Stitch로 초기 시안을 만든 후 Figma로 이관한 경우, 정본은 figma이며 Stitch 프롬프트는 `docs/stitch/history/`에 비정본 아카이브로만 보관합니다 (TASKS.md에서 참조하지 않음).
- **기능 트랙 = no + 디자인 도구 = none 금지**: 아무 작업도 정의되지 않은 상태. 에러 출력 후 재작성 요청.
- **PLAN/TASKS 교체 시 주의**: 기능 구현 완료 후 디자인 트랙을 추가하거나 새 PLAN으로 전환할 때는, `/code-harness` 실행 전 `code-harness/harness-state/`를 수동으로 삭제하세요. 이전 라운드의 `state.json`(currentTaskId/taskQueue/completedTasks)이 새 Task ID 세트와 충돌할 수 있습니다.

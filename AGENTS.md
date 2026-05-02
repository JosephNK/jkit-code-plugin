# AGENTS.md

## 프로젝트 목적

`jkit-code-plugin`은 Next.js / NestJS / Flutter 프로젝트의 lint 규칙 원본을 관리하고, 그로부터 참조 문서와 프로젝트용 기본 문서를 생성하는 저장소다.

## Source Of Truth

원본 (수정 대상)

- Next.js / NestJS: `rules/<framework>/<stack>/eslint.rules.mjs`, `rules/nextjs/base/stylelint.rules.mjs`
- Flutter (`architecture_lint` Dart 패키지): `rules/flutter/base/custom-lint/architecture_lint/lib/src/`
  - `lints/*.dart` (11개 룰 클래스), `constants.dart` (패키지 화이트/블랙리스트·임계값), `classification.dart` (경로 → 레이어 매핑), `layer_semantics.dart` (Role/Contains/Example)

생성물 (직접 수정 금지)

- `lint-rules-structure-reference.md`, `lint-rules-reference.md`, `lint-rules-diagram.md`, `stylelint-rules-reference.md`

문제가 있으면 원본 또는 생성 스크립트를 수정한 뒤 재생성한다.

## 기본 작업 방식

1. 원본 규칙 파일을 수정한다.
2. 해당 generator를 실행한다.
3. `--check`로 드리프트 검증 후 커밋한다.

## Doc 작성 원칙 (lint 규칙 추가/수정 시)

### 핵심 원칙

생성된 md는 **rule 코드의 대체물**이다. LLM이 md만 읽어도 "이런 룰이 있구나, 지켜야 하는구나"를 인지할 수 있어야 한다.

doc에 담을 정보

- **무엇을** 금지/허용 (임계치·차단 패키지·경로 등 구체값 inline)
- **어디에** 적용 (path/layer)
- **왜** (1줄, edge case 판단 근거)

### Flutter Dart lint (`rules/flutter/base/custom-lint/architecture_lint/lib/src/lints/*.dart`)

클래스 직전 `///` doc **첫 줄**이 `lint-rules-reference.md`의 rules table 셀과 glossary Constraints 항목에 surface된다.

형식

```dart
/// {ID}: {자족 룰 진술 + 구체값/짧은 예시 inline}.
///
/// {선택: 1줄 reasoning — md에 표시되지 않고 source 유지보수자만 본다}.
class XxxLint extends DartLint { ... }
```

규칙

- `{ID}:` prefix는 generator가 자동 strip
- Severity / Layer 컬럼과 중복 금지 — `(warning)`, `` `<layer>/`는... `` 등은 컬럼에 이미 있다
- 숫자 임계값은 inline (`maxFileLines` 식별자 대신 `800`)
- 짧은 예시는 첫 줄에 inline (`` (예: `AuthPort`, `UserRepositoryPort`) ``)
- 2번째 줄 이후는 md에 표시되지 않으나 백틱 식별자는 Refs 컬럼 추출 대상

예시

```dart
/// AL_S1: 파일당 800줄 초과 금지 — 단일 책임 위반 신호.
///
/// 800은 경험적 임계치. 한계값은 `maxFileLines` 상수로 조정 가능.
class AlS1FileSizeLint extends DartLint { ... }

/// AL_N1: 클래스명에 `Port` suffix 필수 (예: `AuthPort`, `UserRepositoryPort`).
///
/// 클래스명만으로 레이어 역할을 즉시 식별 — grep/리뷰 효율.
class AlN1PortNamingLint extends DartLint { ... }
```

### Next.js / NestJS ESLint (`rules/<framework>/<stack>/eslint.rules.mjs`)

각 `export const` 직전의 JSDoc은 해당 데이터를 렌더하는 md 섹션의 preface로 surface된다. 룰 데이터(boundary elements 등)에 라인 끝 `//` 코멘트를 적으면 boundary element 표의 "설명" 컬럼으로 surface된다.

규칙

- 1~2문장 — 무엇을 차단/허용 + 왜
- 코드 유지보수자용 메타 정보 금지 (`(doc-only)`, `ESLint 미참조`, `LLM/신규 인원` 등)

surface되는 export

- `baseBoundaryElements` (인라인 `//` → 구조 reference 설명 컬럼)
- `baseLayerSemantics`, `baseBoundaryRules`, `baseBoundaryAllowPatches`, `baseRestrictedPatterns`, `baseRestrictedSyntax`, `baseDomainBannedPackages`, `baseFrameworkPackages`, `baseInfraPackages`, `baseBoundaryIgnores` (또는 `baseIgnores`) → 각 섹션 preface

예시

```js
/**
 * 도메인 레이어(`src/lib/domain/**`)에서 import 금지 패키지.
 * 프레임워크 비의존 유지. 스택별로 UI 라이브러리 추가 차단.
 */
export const baseDomainBannedPackages = [...];
```

### Stylelint (`rules/nextjs/base/stylelint.rules.mjs`)

각 룰 export의 JSDoc이 해당 룰의 설명으로 surface된다. 원칙은 ESLint와 동일.

## 스크립트 역할 구분

- `scripts/gen-agents.mjs` — 입력: `rules/<framework>/base/agents.template.md` → 출력: `AGENTS.md`, `CLAUDE.md→AGENTS.md`. 템플릿을 렌더링해 프로젝트 루트의 에이전트 문서 생성.
- `scripts/gen-architecture.mjs` — 입력: `rules/<framework>/base/architecture.md` → 출력: `ARCHITECTURE.md`. base 아키텍처 문서를 프로젝트 문서로 복사.
- `scripts/gen-git.mjs` — 입력: `rules/common/git.md` → 출력: `GIT.md`. 공통 Git 가이드 복사.
- `scripts/gen-conventions.mjs` — 입력: `rules/<framework>/base/conventions.md` + `rules/<framework>/<stack>/conventions.md` → 출력: `CONVENTIONS.md`. base + 선택 stack conventions 이어 붙임.
- `scripts/typescript/gen-eslint-reference.mjs` — 입력: `eslint.rules.mjs` → 출력: `lint-rules-{structure-reference,reference,diagram}.md`. AST로 export 데이터를 읽어 ESLint 참조 문서 생성. `--check`로 드리프트 검사.
- `scripts/typescript/gen-stylelint-reference.mjs` — 입력: `stylelint.rules.mjs` → 출력: `stylelint-rules-reference.md`. AST로 `*Config` export와 rule JSDoc을 읽어 Stylelint 참조 문서 생성. `--check`로 드리프트 검사.
- `scripts/flutter/gen-custom-lint-reference.mjs` — 입력: `rules/flutter/base/custom-lint/architecture_lint/lib/src/{lints/*.dart, constants.dart, classification.dart, layer_semantics.dart}` + stack lint 패키지(예: `rules/flutter/leaf-kit/custom-lint/leaf_kit_lint/lib/src/`, `rules/flutter/freezed/custom-lint/freezed_lint/lib/src/`) → 출력: `rules/flutter/base/{lint-rules-structure-reference,lint-rules-reference,lint-rules-diagram}.md` + stack별 `rules/flutter/<stack>/lint-rules-reference.md`. Dart 텍스트 파싱으로 룰 doc·`code`·`severity`·target layer + constants의 Set/스칼라 + layer_semantics의 Role/Contains/Example을 합쳐 Flutter 참조 문서 생성. `--check`로 드리프트 검사.

## 프로세스

### Next.js / NestJS

`eslint.rules.mjs` 또는 `stylelint.rules.mjs` 수정 후:

```bash
node scripts/typescript/gen-eslint-reference.mjs <path-to-eslint.rules.mjs>
node scripts/typescript/gen-stylelint-reference.mjs <path-to-stylelint.rules.mjs>
```

### Flutter

`rules/flutter/base/custom-lint/architecture_lint/lib/src/` 하위 원본 수정 후:

```bash
node scripts/flutter/gen-custom-lint-reference.mjs
```

Flutter custom lint 동작 검증이 필요하면 기본적으로 `example_flutter/` 프로젝트를 사용한다.

- `example_flutter/analysis_options.yaml`은 Git 추적 대상이며, lint plugin 연결 검증에 사용한다.
- 검증용 임시 파일은 `example_flutter/lib/features/probe/...` 아래에 만든다.
- 위반 케이스 확인은 `example_flutter/` 루트에서 `dart analyze <probe-file>` 또는 필요한 범위의 `dart analyze`로 수행한다.
- 검증이 끝나면 probe 파일은 삭제하고, 필요한 설정 파일만 유지한다.

## 검증 기준

- 생성 문서가 현재 규칙 정의와 일치해야 한다.
- 생성 문서 형식이 불필요하게 흔들리지 않아야 한다.
- 구조 문서, 규칙 문서, 다이어그램 문서가 서로 모순되지 않아야 한다.

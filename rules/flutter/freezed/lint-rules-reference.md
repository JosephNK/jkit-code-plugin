<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/flutter/gen-custom-lint-reference.mjs -->
<!-- Source: rules/flutter/freezed/custom-lint/freezed_lint/lib/src/ (lints/*.dart) -->

# Lint Rules Reference (flutter/freezed)

## 개요

`freezed` 컨벤션을 선택한 프로젝트의 추가 룰. base의 `architecture_lint`와 함께 `custom_lint` umbrella 하에서 동작 — 두 패키지가 자동 발견·합성된다. freezed_lint은 entities/event/state/params 클래스의 `@freezed` annotation 필수 적용만 강제한다.

## 규칙 (Rules)

freezed 룰 3개. base 룰과 함께 모두 적용된다 (base 12개 + freezed 3개).

| ID | Severity | Layer | 설명 |
| --- | --- | --- | --- |
| FZ_E1 | error | `entities` | entities/ 클래스는 `@freezed` annotation 필수 — 도메인 모델 불변성 보장. |
| FZ_E2 | error | `bloc` | bloc/의 `*Event`/`*State` 클래스는 `@freezed` annotation 필수 — sealed 패턴 강제. |
| FZ_E3 | error | `usecases` | usecases/의 `*Params` 클래스는 `@freezed` annotation 필수 — 입력 모델 불변성. |


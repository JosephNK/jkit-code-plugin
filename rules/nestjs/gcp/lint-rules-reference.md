<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nestjs/gcp/eslint.rules.mjs -->

# Lint Rules Reference (nestjs/gcp)

## Framework 금지 패키지 (순수 레이어 차단)

Framework 목록에 포함 → model/, port/, exception/ 에서 차단.
도메인 계층이 특정 클라우드 벤더에 의존하는 상황 방지.

- `@google-cloud/*`

## Infra 금지 패키지 (service 레이어 차단)

Infra 목록에 포함 → service/ 에서도 직접 import 차단.
GCP SDK는 provider/ 계층에서 Port 구현체로만 호출한다.

- `@google-cloud/*`

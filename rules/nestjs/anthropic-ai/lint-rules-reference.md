<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nestjs/anthropic-ai/eslint.rules.mjs -->

# Lint Rules Reference (nestjs/anthropic-ai)

## Framework 금지 패키지 (순수 레이어 차단)

Framework 목록 → model/, port/, exception/ 차단.
도메인 타입에 Anthropic 응답 구조가 노출되지 않도록.

- `@anthropic-ai/*`

## Infra 금지 패키지 (service 레이어 차단)

Infra 목록 → service/ 직접 사용 차단.
LLM 호출은 provider/ 에서 Port 구현체로 캡슐화.

- `@anthropic-ai/*`

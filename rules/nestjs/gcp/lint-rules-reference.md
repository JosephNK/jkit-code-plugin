<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nestjs/gcp/eslint.rules.mjs -->

# Lint Rules Reference (nestjs/gcp)

## Framework 금지 패키지 (순수 레이어 차단)

Framework 차단 — 도메인이 특정 클라우드 벤더 타입에 의존 금지.

- `@google-cloud/*`

## Infra 금지 패키지 (service 레이어 차단)

Infra 차단 — service에서 직접 호출 금지, provider Port 구현체에서만 사용.

- `@google-cloud/*`

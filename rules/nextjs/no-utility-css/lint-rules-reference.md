<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nextjs/no-utility-css/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/no-utility-css)

## Restricted Patterns (Import 금지 패턴)

Utility CSS 프레임워크 import 차단.

이유:
- 컴포넌트 기반 디자인 시스템과 utility CSS는 토큰 시스템이 이중화되어
  번들 크기 증가 + 테마 관리 분산을 유발한다.
- 스타일 전략을 "UI lib style props → style prop → CSS Modules" 한 줄기로
  단일화해야 유지보수성이 확보된다.

CSS-in-JS 차단은 UI lib마다 다른 결정 사항이므로 여기서는 다루지 않는다
(각 UI lib 스택의 책임).

| 패턴 | 메시지 |
| --- | --- |
| `tailwindcss`, `tailwindcss/**`, `unocss`, `unocss/**`, `windicss`, `windicss/**` | Utility CSS frameworks are not allowed. Use the project UI library style props or CSS Modules. |

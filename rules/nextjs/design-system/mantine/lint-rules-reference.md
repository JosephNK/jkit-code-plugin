<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/design-system/mantine/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/design-system/mantine)

## Restricted Patterns (Import 금지 패턴)

다른 런타임 CSS-in-JS 차단 — Mantine의 Emotion과 이중 설정 발생 방지.

| 패턴 | 메시지 |
| --- | --- |
| `@emotion/*`, `styled-components`, `styled-jsx`, `styled-jsx/**` | CSS-in-JS libraries are not allowed. Use Mantine style props or CSS Modules. |

## Domain Purity (도메인 순수성)

도메인 레이어에서 Mantine 전체 차단 — 도메인은 UI 프레임워크 비의존.

### 도메인 레이어 금지 패키지

- `@mantine/**`

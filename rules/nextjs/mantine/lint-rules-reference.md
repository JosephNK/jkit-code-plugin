<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/mantine/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/mantine)

## Restricted Patterns (Import 금지 패턴)

다른 런타임 CSS-in-JS 차단 — Mantine의 Emotion과 이중 설정 발생 방지.

| 패턴 | 메시지 |
| --- | --- |
| `@emotion/*`, `styled-components`, `styled-jsx`, `styled-jsx/**` | CSS-in-JS libraries are not allowed. Use Mantine style props or CSS Modules. |

## Restricted Syntax (AST 금지 구문)

`component="a"` 금지 — anchor 태그는 Next.js SPA 네비게이션 우회로 전체 리로드 유발.
대안: `component={Link}` (next/link).

| Selector | 메시지 |
| --- | --- |
| `JSXAttribute[name.name='component'][value.value='a']` | Do not use component="a" for internal links — it causes full page reload. Use component={Link} from next/link instead. |

## Domain Purity (도메인 순수성)

도메인 레이어에서 Mantine 전체 차단 — 도메인은 UI 프레임워크 비의존.

### 도메인 레이어 금지 패키지

- `@mantine/**`

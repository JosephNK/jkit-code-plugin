<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/antd/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/antd)

## Restricted Patterns (Import 금지 패턴)

다른 런타임 CSS-in-JS 차단 — antd의 `@ant-design/cssinjs`와 캐시·토큰이 충돌.
해결 경로: `ConfigProvider.theme` + `className`/`style` prop + CSS Modules.

| 패턴 | 메시지 |
| --- | --- |
| `@emotion/*`, `styled-components`, `styled-jsx`, `styled-jsx/**` | CSS-in-JS libraries are not allowed. antd uses @ant-design/cssinjs internally — use ConfigProvider tokens, component className/style props, or CSS Modules. |

## Domain Purity (도메인 순수성)

도메인 레이어에서 antd 계열 전체 차단 — 도메인은 UI 프레임워크 비의존.

### 도메인 레이어 금지 패키지

- `antd` (+ 서브경로)
- `@ant-design/**`

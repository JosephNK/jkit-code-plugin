<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/antd/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/antd)

## Restricted Patterns (Import 금지 패턴)

antd는 내부적으로 `@ant-design/cssinjs`를 CSS-in-JS 런타임으로 사용한다.
여기에 다른 런타임 CSS-in-JS(Emotion, styled-components, styled-jsx 등)를
병행 도입하면 **두 개의 스타일 캐시·토큰 소스**가 공존하게 되어
테마 토큰 동기화·삽입 순서·우선순위가 깨진다.

해결 경로: antd `ConfigProvider.theme` + `className`/`style` prop + CSS Modules.

| 패턴 | 메시지 |
| --- | --- |
| `@emotion/*`, `styled-components`, `styled-jsx`, `styled-jsx/**` | CSS-in-JS libraries are not allowed. antd uses @ant-design/cssinjs internally — use ConfigProvider tokens, component className/style props, or CSS Modules. |

## Domain Purity (도메인 순수성)

도메인 레이어(`src/lib/domain/**`)에서 antd 계열 패키지 전체 차단.
도메인은 UI 프레임워크에 의존하면 안 되므로 `antd`, `@ant-design/*` 어떤
하위 패키지도 import 금지.

### 도메인 레이어 금지 패키지

- `antd` (+ 서브경로)
- `@ant-design/**`

<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/design-system/shadcn/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/design-system/shadcn)

## Restricted Patterns (Import 금지 패턴)

다른 런타임 CSS-in-JS 차단 — shadcn은 Tailwind utility class + CSS 변수 기반이라
CSS-in-JS와 섞으면 클래스 우선순위·SSR hydration·테마 토큰이 어긋난다.
해결 경로: Tailwind utility + `cn()` (`@/lib/utils`의 `clsx` + `tailwind-merge`) 또는 CSS Modules.

| 패턴 | 메시지 |
| --- | --- |
| `@emotion/*`, `styled-components`, `styled-jsx`, `styled-jsx/**` | CSS-in-JS libraries are not allowed. shadcn/ui composes Tailwind utility classes — use the cn() helper from @/lib/utils or CSS Modules instead. |

## Domain Purity (도메인 순수성)

도메인 레이어에서 shadcn 기반 UI 의존 전체 차단 — 도메인은 UI 프레임워크 비의존.
shadcn 컴포넌트가 의존하는 underlying primitives(Radix·lucide-react·CVA·class helpers)는
presentation 레이어 전용. 도메인이 className/variant 조립을 시도하면 UI 책임이 누수된다.

### 도메인 레이어 금지 패키지

- `@radix-ui/**`
- `lucide-react`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`

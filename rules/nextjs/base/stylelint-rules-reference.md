<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-stylelint-reference.mjs -->
<!-- Source: rules/nextjs/base/stylelint.rules.mjs -->
<!-- Export: stylelintBaseConfig -->

# Stylelint Rules Reference (nextjs/base)

## Baseline

- **Extends**: `stylelint-config-standard`
- **Plugins**: `stylelint-declaration-strict-value`

Stylelint baseline — 모든 Next.js 프로젝트 공통 규약.

Bundled:
- `stylelint-config-standard` (공식 권장 룰셋)
- `stylelint-declaration-strict-value` (토큰 하드코딩 차단 플러그인)

사용자 프로젝트는 `stylelint.config.mjs`에서 spread + 추가 rules로 override.

## Rule 1: `declaration-property-value-disallowed-list`

Accessibility-critical 속성의 `var()` 값은 fallback 필수 (severity: warning).

### Configuration

- **Enforced properties**: `outline`, `outline-color`, `box-shadow`, `color`, `background`, `background-color`, `border`, `border-color`, `border-top`, `border-right`, `border-bottom`, `border-left`
- **Disallowed value patterns**: `/var\(--[^,)]+\)$/`
- **Severity**: `warning`
- **Stylelint message**:
  > CSS variables in accessibility-critical declarations must include a fallback value. Use `var(--token, <fallback>)`. A single undefined var() invalidates the entire declaration, removing browser default focus rings and causing FOUC on pre-hydration paths.

### Why

fallback 없는 `var()`가 미정의되면 선언 전체가 `invalid-at-computed-value`가 되어
브라우저 기본 outline·색까지 무효화 → 포커스 링 소실·FOUC. WCAG 2.4.7 리스크.
Theme provider 하이드레이션 이전 경로(SSR 초기 페인트, error.tsx, not-found.tsx)에서 재현.

### Examples

**Bad**

```css
outline: 2px solid var(--mantine-primary-color-filled);
```

**Good**

```css
outline: 2px solid var(--mantine-primary-color-filled, #005da7);
```

## Rule 2: `scale-unlimited/declaration-strict-value`

디자인 토큰 리터럴 차단 — `var(--token)` 또는 design-token 참조만 허용 (컨벤션 C13).

### Configuration

- **Enforced properties**: `/color$/`, `fill`, `stroke`, `font-family`, `border-radius`, `box-shadow`
- **Allowed values (ignoreValues)**: `/^var\(/`, `transparent`, `inherit`, `currentColor`, `unset`, `initial`, `none`, `0`, `auto`
- **Allowed functions (ignoreFunctions)**: `var`
- **Stylelint message (fn)**:
  ```js
  (property) =>
            `Expected \`var(--token, <fallback>)\` or design-token reference for \`${property}\`. ` +
            'Hardcoded values bypass theme tokens (src/theme.ts) and break dark/light switching.'
  ```

### Why

리터럴 색/radius/shadow가 섞이면 `src/theme.ts` 토큰 정책이 무력화되고
다크/라이트 테마 전환이 깨진다. JSX 인라인 style의 동일 정책은 ESLint custom rule
`no-inline-style-tokens`가 대칭 커버.

### Examples

**Bad**

```css
color: #ff0000;
border-radius: 12px;
```

**Good**

```css
color: var(--mantine-color-text, #1a1a1a);
border-radius: var(--mantine-radius-md, 8px);
```

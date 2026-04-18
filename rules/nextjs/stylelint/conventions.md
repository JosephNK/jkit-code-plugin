## Stylelint

All CSS (`*.css`, `*.module.css`, `*.scss`) is linted by stylelint via `stylelint.config.mjs` at the project root.

- Base preset: `stylelint-config-standard`
- jkit baseline rules: imported from `@jkit/eslint-rules/nextjs/stylelint/stylelint.base.mjs`
- Pre-commit: `lint-staged` runs `stylelint --fix` on staged CSS files

### CSS Variable Fallback Policy

Accessibility-critical and pre-hydration-reachable declarations **MUST** provide a fallback when using `var()`.

**Why**: a single undefined `var(--x)` invalidates the entire declaration at computed-value time, removing even the browser's default focus ring and causing FOUC. Theme-provider-injected variables (e.g., `--mantine-*`) are undefined on render paths that run before hydration — SSR initial paint, `error.tsx`, `not-found.tsx`, and error-boundary fallbacks.

**Enforced properties** (stylelint warning on violation):

- `outline`, `outline-color`
- `box-shadow`
- `color`, `background`, `background-color`
- `border`, `border-color`, `border-top`/`-right`/`-bottom`/`-left`

**Bad**

```css
:focus-visible {
  outline: 2px solid var(--mantine-primary-color-filled);
}
```

**Good**

```css
:focus-visible {
  outline: 2px solid var(--mantine-primary-color-filled, #005da7); /* fallback matches theme.ts primary[6] */
}
```

### Token Hardcoding Policy

Design tokens (color, radius, shadow, font-family 등) 은 `src/theme.ts` (또는 CSS 변수)에만 정의되고, CSS에서는 `var(--token)` 형태로만 소비되어야 한다. 컨벤션 **C13** — 하드코딩 차단은 `stylelint-declaration-strict-value` 플러그인으로 강제한다.

**Enforced properties**:

- 색 계열: `color`, `background-color`, `border-color`, `outline-color`, 기타 `*-color` (정규식 `/color$/`)
- SVG: `fill`, `stroke`
- 레이아웃: `font-family`, `border-radius`, `box-shadow`

**Allowed values** (ignoreValues):

- `var(...)` — 토큰 정본 소비 경로
- CSS 키워드: `transparent`, `inherit`, `currentColor`, `unset`, `initial`
- 기본값 해제: `none`, `0`, `auto`

**Bad**

```css
.card {
  color: #ff0000;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-family: 'Inter';
}
```

**Good**

```css
.card {
  color: var(--mantine-color-text, #1a1a1a);
  background-color: var(--mantine-color-body, #ffffff);
  border-radius: var(--mantine-radius-md, 8px);
  box-shadow: var(--mantine-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.12));
  font-family: var(--mantine-font-family);
}
```

> var() fallback 은 위의 "CSS Variable Fallback Policy" 가 함께 요구한다 (접근성·pre-hydration 경로).

### Scope Notes

- `.css` / `.module.css` / `.scss` 파일은 stylelint가 완전 커버 (var fallback + strict-value).
- JSX inline `style={{ ... }}` 는 ESLint `no-inline-style-tokens` 스택이 **대칭 커버** 한다 — 같은 키(`fontFamily`/`borderRadius`/`boxShadow`/색 계열)에 같은 정책(`var()`/theme 참조만 허용) 적용.
- styled-components / emotion 등 CSS-in-JS 템플릿 리터럴은 기본 커버 밖. 프로젝트가 사용 시 `stylelint-processor-styled-components` 같은 프로세서 추가.
- 유틸리티 CSS 프레임워크(Tailwind 등)는 `className="bg-[#f00]"` 같은 arbitrary value 경로로 토큰 정책을 우회한다. stylelint는 이 경로를 보지 못하므로, 해당 우회를 막으려면 `no-utility-css` 스택을 함께 켜야 한다.

### Documentation Reference

- Always check latest stylelint docs via Context7 MCP when adjusting rules
- `stylelint-declaration-strict-value` 공식 옵션 참고: https://github.com/AndyOGo/stylelint-declaration-strict-value
- Prefer Context7 docs over training data (training cutoff)

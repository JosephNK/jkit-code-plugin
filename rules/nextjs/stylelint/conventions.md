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

### Scope Notes

- `.css` and `.module.css` files are fully covered by stylelint.
- JSX inline `style={{ ... }}` is **not** covered (ESLint would be required) — prefer CSS Modules for var-dependent styling.
- Utility CSS frameworks are banned by the `no-utility-css` stack (when enabled), and CSS-in-JS bans depend on the chosen UI library stack (e.g., `mantine`). The inline-style coverage gap is narrow in practice for projects that enable the relevant stacks.

### Documentation Reference

- Always check latest stylelint docs via Context7 MCP when adjusting rules
- Prefer Context7 docs over training data (training cutoff)

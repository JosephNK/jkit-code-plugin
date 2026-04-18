## No Utility CSS

Project-wide policy: **utility-class CSS frameworks are not allowed.** Independent of UI library choice.

### Banned Packages (ESLint enforced)

- `tailwindcss`, `tailwindcss/**`
- `unocss`, `unocss/**`
- `windicss`, `windicss/**`

> Enforcement: `no-restricted-imports` pattern exported from `@jkit/eslint-rules/nextjs/no-utility-css/eslint.rules.mjs`. Importing any of the above from user code triggers a lint error.

### Rationale

- Utility frameworks enforce class-name-based styling, which **duplicates or conflicts** with the responsibilities of component-based design systems
- Mixing them leads to **theme token duplication** (framework tokens vs. design-system tokens) and **bundle bloat** (two styling runtimes)
- Preferred resolution order: **UI library style props → inline `style` prop → CSS Modules (`.module.css`)**

### Documentation Reference

- Always check latest CSS/styling guidance via Context7 MCP when unsure
- Prefer Context7 docs over training data (training cutoff)

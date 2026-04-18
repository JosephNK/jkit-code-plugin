## Mantine

All UI components **MUST** use Mantine.

- **UI components** (buttons, inputs, text, layout, feedback, etc.) **MUST use Mantine** — semantic HTML (`<form>`, `<section>`, `<nav>`, etc.) is allowed as-is
- Use Mantine docs to find the appropriate component for each HTML element
- Theme customization: manage via `createTheme()` in `src/theme.ts`
- Docs: https://mantine.dev/llms.txt
- Per-component docs: https://mantine.dev/llms/{component-name}.md
- Full docs (single file): https://mantine.dev/llms-full.txt

### Styling Rules

- Style customization priority: Mantine `style props` → `style` prop → CSS Modules (`.module.css`)
- **NO utility CSS frameworks** (Tailwind, UnoCSS, etc.) — Mantine style props cover most cases
- Light/dark: `defaultColorScheme="auto"` — Mantine handles color scheme switching; do NOT use manual dark mode CSS selectors or hardcode colors for a single scheme

### Documentation Reference

- Always check latest docs via Context7 MCP before writing/reviewing Mantine code
- Prefer Context7 docs over training data (training cutoff)

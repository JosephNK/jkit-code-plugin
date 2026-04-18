## Mantine

All UI components **MUST** use Mantine (**version 9 or higher**).

- Minimum version: `"@mantine/core": "^9.0.0"` (apply the same `^9.0.0` constraint to matching packages: `@mantine/hooks`, `@mantine/form`, `@mantine/notifications`, etc.)
- **UI components** (buttons, inputs, text, layout, feedback, etc.) **MUST use Mantine** — semantic HTML (`<form>`, `<section>`, `<nav>`, etc.) is allowed as-is
- Use Mantine docs to find the appropriate component for each HTML element
- Theme customization: manage via `createTheme()` in `src/theme.ts`
- Docs: https://mantine.dev/llms.txt
- Per-component docs: https://mantine.dev/llms/{component-name}.md
- Full docs (single file): https://mantine.dev/llms-full.txt

### Styling Rules

- Style customization priority: Mantine `style props` → `style` prop → CSS Modules (`.module.css`)
- Light/dark: `defaultColorScheme="auto"` — Mantine handles color scheme switching; do NOT use manual dark mode CSS selectors or hardcode colors for a single scheme

> For the ban on utility CSS frameworks, see the separate `css-policy` conventions module.

### Next.js Config (Tree-shaking)

Register Mantine packages in `next.config.ts` via `experimental.optimizePackageImports` so Next.js rewrites named imports into per-module imports (Mantine v9 official guide).

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
};

export default nextConfig;
```

- List every Mantine package the project actually imports (`@mantine/form`, `@mantine/notifications`, `@mantine/dates`, etc.)
- Effect: smaller initial bundle, faster dev/build (only used components are bundled instead of the full 120+ component surface)
- Source: https://mantine.dev/guides/next/

### Documentation Reference

- Always check latest docs via Context7 MCP before writing/reviewing Mantine code
- Prefer Context7 docs over training data (training cutoff)

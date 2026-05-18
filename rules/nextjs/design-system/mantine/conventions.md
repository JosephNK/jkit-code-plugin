## Mantine

All UI components **MUST** use Mantine (**version 9 or higher**).

- Minimum version: `"@mantine/core": "^9.0.0"` (apply the same `^9.0.0` constraint to matching packages: `@mantine/hooks`, `@mantine/form`, `@mantine/notifications`, etc.)
- **UI components** (buttons, inputs, text, layout, feedback, etc.) **MUST use Mantine** — semantic HTML (`<form>`, `<section>`, `<nav>`, etc.) is allowed as-is
- Use Mantine docs to find the appropriate component for each HTML element
- Theme customization: manage via `createTheme()` in `src/theme.ts`
- Docs: https://mantine.dev/llms.txt
- Per-component docs: https://mantine.dev/llms/{component-name}.md
- Full docs (single file): https://mantine.dev/llms-full.txt

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
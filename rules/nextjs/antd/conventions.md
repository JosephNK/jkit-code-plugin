## Ant Design (antd)

All UI components **MUST** use Ant Design (**version 6 or higher**).

- Minimum version: `"antd": "^6.0.0"` (apply the same `^6.0.0` constraint to `@ant-design/icons`)
- React **18 or higher** is required
- antd v6 uses **CSS variables by default** and supports modern browsers only (no IE)
- **UI components** (buttons, inputs, text, layout, feedback, etc.) **MUST use antd** — semantic HTML (`<form>`, `<section>`, `<nav>`, etc.) is allowed as-is
- Use antd docs to find the appropriate component for each HTML element
- Theme customization: manage via `ConfigProvider` (`theme` prop) with tokens/overrides centralized in `src/theme.ts`
- Icons: `@ant-design/icons` (v6)
- SSR: wrap app in `AntdRegistry` from `@ant-design/nextjs-registry` in the root layout to avoid style-flashing under the App Router
- Docs: https://ant.design/

### Styling Rules

- Style customization priority: antd **component props (`className` / `style`)** → CSS Modules (`.module.css`)
- Theme / token / algorithm changes go through `ConfigProvider.theme` — do NOT hardcode colors or write manual dark-mode CSS selectors
- antd internally uses `@ant-design/cssinjs`. **Do not add additional CSS-in-JS runtimes** (Emotion, styled-components, styled-jsx) — a second runtime causes dual style caches and token divergence.

> For the ban on utility CSS frameworks (Tailwind, UnoCSS, WindiCSS), see the separate `no-utility-css` conventions module.

### Navigation

- **Internal links MUST use `next/link`** — NOT antd components with `href` to internal paths
- For antd components linking to internal pages (`Button`, `Menu`, `Dropdown` items, etc.), wrap with `<Link>` from `next/link`
- `href` prop on antd components is only allowed for **external URLs** (e.g., `https://...`)
- Reason: direct `href` on antd components renders a plain anchor and causes full page reload, breaking client-side navigation

```tsx
// WRONG — causes full page reload
<Button type="primary" href={`/${locale}/admin/users`}>Manage</Button>

// CORRECT — client-side navigation
import Link from 'next/link';
<Link href={`/${locale}/admin/users`}>
  <Button type="primary">Manage</Button>
</Link>
```

### Next.js Config (Tree-shaking)

Register antd-related packages in `next.config.ts` via `experimental.optimizePackageImports` so Next.js rewrites named imports into per-module imports:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons"],
  },
};

export default nextConfig;
```

- Add `@ant-design/*` packages the project actually imports
- Effect: smaller initial bundle, faster dev/build (only used components bundled)

### Documentation Reference

- Always check latest docs via Context7 MCP before writing/reviewing antd code
- Prefer Context7 docs over training data (training cutoff)

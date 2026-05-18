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

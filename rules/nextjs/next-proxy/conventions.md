## Next Proxy

Use `proxy.ts` instead of `middleware.ts` (Next.js 16+).

### Next.js 16 Breaking Changes

- `middleware.ts` → `proxy.ts` (src/ or root), export `middleware()` → `proxy()`
- Proxy runtime is nodejs (edge not supported)
- Config flag: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`
- Codemod: `npx @next/codemod@latest middleware-to-proxy .`

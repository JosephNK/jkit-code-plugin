/**
 * 경로 트리 시각화용 주석 (doc-only, ESLint 미참조).
 * App Router 관례(layout/page/route group/nested dynamic) 등
 * boundary glob만으로 안 드러나는 하위 폴더 의도를 트리에 추가.
 *
 * 표기 컨벤션:
 *   `<name>`            doc placeholder — 실제 폴더는 구체 이름 (예: `<feature>` → `users`, `products`)
 *   `[name]`/`[...name]` Next.js 동적 세그먼트 — 브래킷이 진짜 폴더명의 일부 (안의 이름만 가변)
 *   `(name)`            Next.js route group — 괄호가 진짜 폴더명의 일부 (URL 미포함)
 */
export const baseStructureAnnotations = {
  'src/app': {
    override: [
      {
        name: '[locale]',
        note: 'Locale 동적 세그먼트 (Next.js literal — 폴더명이 그대로 `[locale]`)',
        children: [
          { name: 'layout.tsx', note: 'Root layout (Server Component)' },
          { name: 'page.tsx', note: 'Home page (Server Component)' },
          { name: 'loading.tsx', note: 'Suspense fallback UI (선택)' },
          { name: 'error.tsx', note: "Error boundary ('use client' 필수)" },
          { name: 'not-found.tsx', note: '404 페이지 (선택)' },
          { name: '_components', note: "Page-colocated Client Components ('use client')" },
          { name: '_providers', note: "Page-colocated Providers ('use client')" },
          { name: 'dictionaries.ts', note: 'i18n dictionary loader' },
          {
            name: '(group)',
            note: 'Next.js route group — 괄호가 진짜 폴더명. URL 미포함. 실제: `(protected)`, `(auth)` 등',
          },
          {
            name: '<feature>',
            placeholder: true,
            note: 'doc placeholder — 실제 폴더는 구체 이름 (예: `users/`, `products/`, `dashboard/`)',
            children: [
              { name: 'page.tsx' },
              { name: '_components', note: '이 레벨에도 가능 (glob `**` 매칭)' },
              {
                name: '[id]',
                note: 'Next.js 동적 세그먼트 — 브래킷이 진짜 폴더명. 안의 이름은 가변 (`[id]`, `[slug]`, `[orderId]` 등)',
                children: [{ name: 'page.tsx' }],
              },
            ],
          },
        ],
      },
      {
        name: 'api',
        note: 'Route Handlers 관용 위치 — `/api/*` URL prefix용 (Next.js는 `api/` 자체를 강제하지 않음, `app/**/route.ts` 어디든 OK)',
        children: [
          {
            name: '<resource>',
            placeholder: true,
            note: 'doc placeholder — 실제 폴더는 구체 자원명 (예: `users/`, `auth/`, `projects/`)',
            children: [
              { name: 'route.ts', note: 'HTTP 핸들러 (GET/POST/PUT/DELETE export)' },
              {
                name: '[id]',
                note: 'Next.js 동적 세그먼트 — 폴더명이 그대로 `[id]` 또는 `[slug]` 등',
                children: [{ name: 'route.ts' }],
              },
              {
                name: '[...slug]',
                note: 'Next.js catch-all 세그먼트 — 폴더명이 그대로 `[...slug]` (예: `auth/[...nextauth]`)',
                children: [{ name: 'route.ts' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

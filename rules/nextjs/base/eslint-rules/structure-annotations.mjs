/**
 * 경로 트리 시각화용 주석 (doc-only, ESLint 미참조).
 * App Router 관례(layout/page/route group/nested dynamic) 등
 * boundary glob만으로 안 드러나는 하위 폴더 의도를 트리에 추가.
 */
export const baseStructureAnnotations = {
  'src/app': {
    override: [
      {
        name: '[locale]',
        note: 'Locale dynamic segment (lint 강제 — 리터럴 폴더명)',
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
            placeholder: true,
            note: 'Route group — URL에 미포함. 실제 이름: (protected), (auth) 등. 하위는 [feature] 패턴과 동일',
          },
          {
            name: '[feature]',
            placeholder: true,
            note: '실제 이름 가변: user, product, dashboard 등',
            children: [
              { name: 'page.tsx' },
              { name: '_components', note: '이 레벨에도 가능 (glob `**` 매칭)' },
              {
                name: '[id]',
                placeholder: true,
                note: 'Dynamic route param (선택)',
                children: [{ name: 'page.tsx' }],
              },
            ],
          },
        ],
      },
      {
        name: 'api',
        note: 'Route Handlers — HTTP API 엔드포인트 (Next.js가 호스팅, [locale] 밖)',
        children: [
          {
            name: '[resource]',
            placeholder: true,
            note: '실제 이름 가변: auth, projects, admin, user 등',
            children: [
              { name: 'route.ts', note: 'HTTP 핸들러 (GET/POST/PUT/DELETE export)' },
              {
                name: '[id]',
                placeholder: true,
                note: 'Dynamic param (예: projects/[id])',
                children: [{ name: 'route.ts' }],
              },
              {
                name: '[...slug]',
                placeholder: true,
                note: 'Catch-all 세그먼트 (예: auth/[...nextauth])',
                children: [{ name: 'route.ts' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

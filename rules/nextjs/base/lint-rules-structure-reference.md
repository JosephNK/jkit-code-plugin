<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/base/eslint.rules.mjs (baseBoundaryElements, baseStructureAnnotations) -->

# Lint Rules — Structure Reference (nextjs/base)

## 개요

아키텍처 경계 — 각 레이어 type ↔ 경로 매핑.
`mode: 'full'`은 글로브로 전체 경로 매칭 (단일 파일·feature-first per-file glob).
레이어 책임은 `baseLayerSemantics` 참조.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. 표기 컨벤션: `<name>` = doc placeholder (실제 폴더는 구체 이름, 예: `<feature>` → `users/`/`products/`). `[name]`/`[...name]`/`(name)` = Next.js 라우팅 컨벤션 (브래킷/괄호가 진짜 폴더명의 일부). lint는 glob(`**`, `*`)로 유연 매칭, `[locale]`처럼 명시된 literal bracket은 그대로 강제합니다.

```
└── src/
    ├── app/                      # page — 최상위 페이지 catch-all
    │   ├── [locale]/             # Locale 동적 세그먼트 (Next.js literal — 폴더명이 그대로 `[locale]`)
    │   │   ├── _components/      # page-component — Page-colocated Client Components ('use client')
    │   │   ├── _providers/       # page-provider — Page-colocated Providers ('use client')
    │   │   ├── (group)/          # Next.js route group — 괄호가 진짜 폴더명. URL 미포함. 실제: `(protected)`, `(auth)` 등
    │   │   ├── <feature>/        # feature module — 실제 이름 가변 (예: `users/`, `products/`, `dashboard/`)
    │   │   │   ├── _components/  # page-component — 이 레벨에도 가능 (glob `**` 매칭)
    │   │   │   ├── [id]/         # Next.js 동적 세그먼트 — 브래킷이 진짜 폴더명. 안의 이름은 가변 (`[id]`, `[slug]`, `[orderId]` 등)
    │   │   │   │   └── page.tsx
    │   │   │   └── page.tsx
    │   │   ├── dictionaries.ts   # dictionary — i18n dictionary loader
    │   │   ├── error.tsx         # Error boundary ('use client' 필수)
    │   │   ├── layout.tsx        # Root layout (Server Component)
    │   │   ├── loading.tsx       # Suspense fallback UI (선택)
    │   │   ├── not-found.tsx     # 404 페이지 (선택)
    │   │   └── page.tsx          # Home page (Server Component)
    │   └── api/                  # Route Handlers — `/api/*` 관례 위치
    │       └── <resource>/       # API resource — 실제 이름 가변 (예: `users/`, `auth/`, `projects/`)
    │           ├── [...slug]/    # Next.js catch-all 세그먼트 — 폴더명이 그대로 `[...slug]` (예: `auth/[...nextauth]`)
    │           │   └── route.ts  # route-handler — API 진입점 (얇은 HTTP 어댑터)
    │           ├── [id]/         # Next.js 동적 세그먼트 — 폴더명이 그대로 `[id]` 또는 `[slug]` 등
    │           │   └── route.ts  # route-handler — API 진입점 (얇은 HTTP 어댑터)
    │           └── route.ts      # route-handler — HTTP 핸들러 (GET/POST/PUT/DELETE export)
    ├── components/               # shared-ui — 전역 재사용 컴포넌트
    ├── db/                       # db — DB 드라이버 래퍼
    ├── domain/
    │   └── <feature>/            # feature module — 실제 이름 가변 (예: `users/`, `products/`, `dashboard/`)
    │       ├── errors.ts         # domain-error — 도메인 에러
    │       ├── model.ts          # domain-model — Entity·VO
    │       ├── port.ts           # domain-port — Repository 인터페이스
    │       └── service.ts        # domain-service — UseCase/서비스
    ├── email-templates/          # email-template — React Email 등 이메일 템플릿
    ├── http/
    │   ├── _generated/
    │   │   ├── endpoints.ts      # http-endpoint — (generated) URL 헬퍼
    │   │   └── types.ts          # http-dto — (generated) DTO 타입
    │   ├── <feature>/            # feature module — 실제 이름 가변 (예: `users/`, `products/`, `dashboard/`)
    │   │   ├── hook.ts           # http-hook — TanStack Query 훅
    │   │   ├── mapper.ts         # http-mapper — DTO ↔ Domain 변환
    │   │   └── repository.ts     # http-repository — Port 구현체
    │   └── client.ts             # http-client — HTTP 클라이언트
    └── lib/
        ├── dictionaries/
        │   └── *                 # dictionary — i18n 사전
        ├── types/                # shared-type — 전역 타입
        └── utils/
            ├── *.ts              # lib-shared — 공용 유틸 함수
            └── index.ts          # lib-shared-barrel — 공용 유틸 barrel (re-export 전용)
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `domain-model` | `src/domain/*/model.ts` | `full` | Entity·VO |
| `domain-error` | `src/domain/*/errors.ts` | `full` | 도메인 에러 |
| `domain-port` | `src/domain/*/port.ts` | `full` | Repository 인터페이스 |
| `domain-service` | `src/domain/*/service.ts` | `full` | UseCase/서비스 |
| `http-client` | `src/http/client.ts` | `full` | HTTP 클라이언트 |
| `http-endpoint` | `src/http/_generated/endpoints.ts` | `full` | (generated) URL 헬퍼 |
| `http-dto` | `src/http/_generated/types.ts` | `full` | (generated) DTO 타입 |
| `http-mapper` | `src/http/*/mapper.ts` | `full` | DTO ↔ Domain 변환 |
| `http-repository` | `src/http/*/repository.ts` | `full` | Port 구현체 |
| `http-hook` | `src/http/*/hook.ts` | `full` | TanStack Query 훅 |
| `lib-shared-barrel` | `src/lib/utils/index.ts` | `full` | 공용 유틸 barrel (re-export 전용) |
| `lib-shared` | `src/lib/utils/*.ts` | `full` | 공용 유틸 함수 |
| `dictionary` | `src/lib/dictionaries/*` / `src/app/\[locale\]/dictionaries.ts` | `full` | i18n 사전 |
| `shared-type` | `src/lib/types` | — | 전역 타입 |
| `db` | `src/db` | — | DB 드라이버 래퍼 |
| `shared-ui` | `src/components` | — | 전역 재사용 컴포넌트 |
| `page-component` | `src/app/\[locale\]/**/_components` | — | 페이지 전용 컴포넌트 ([locale] 아래) |
| `page-provider` | `src/app/\[locale\]/**/_providers` | — | 페이지 전용 Provider ([locale] 아래) |
| `email-template` | `src/email-templates` | — | React Email 등 이메일 템플릿 |
| `route-handler` | `src/app/**/route.ts` | `full` | API 진입점 (얇은 HTTP 어댑터) |
| `page` | `src/app` | — | 최상위 페이지 catch-all |

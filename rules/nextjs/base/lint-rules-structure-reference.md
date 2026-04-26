<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/base/eslint.rules.mjs (baseBoundaryElements, baseStructureAnnotations) -->

# Lint Rules — Structure Reference (nextjs/base)

## 개요

아키텍처 경계 — 각 레이어 type ↔ 경로 매핑.
`mode: 'full'`은 단일 파일 정확 매칭. 레이어 책임은 `baseLayerSemantics` 참조.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 유연하게 매칭하므로 `[feature]`, `(group)`, `[id]` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다. `[locale]`처럼 리터럴 bracket은 lint가 강제합니다.

```
└── src/
    ├── lib/
    │   ├── domain/
    │   │   ├── models/           # domain-model — 엔티티/값 객체
    │   │   ├── errors/           # domain-error — 도메인 에러 타입
    │   │   ├── ports/            # domain-port — Repository 인터페이스
    │   │   └── services/         # domain-service — UseCase/서비스
    │   ├── api/
    │   │   ├── client.ts         # api-client — HTTP 클라이언트 단일 파일
    │   │   ├── endpoints.ts      # api-endpoint — 엔드포인트 URL 상수
    │   │   ├── types.ts          # api-dto — 외부 API 응답 타입
    │   │   ├── mappers/          # api-mapper — DTO ↔ Domain 변환
    │   │   ├── repositories/     # api-repository — Port 구현체
    │   │   └── hooks/            # api-hook — React Query 훅 등
    │   ├── *.ts                  # lib-shared — src/lib 루트 공용 유틸
    │   ├── db/                   # db — DB 드라이버 래퍼
    │   └── email-templates/      # email-template — React Email 등 이메일 템플릿
    ├── components/               # shared-ui — 전역 재사용 컴포넌트
    ├── app/                      # page — 최상위 페이지 catch-all
    │   ├── [locale]/             # Locale dynamic segment (lint 강제 — 리터럴 폴더명)
    │   │   ├── layout.tsx        # Root layout (Server Component)
    │   │   ├── page.tsx          # Home page (Server Component)
    │   │   ├── loading.tsx       # Suspense fallback UI (선택)
    │   │   ├── error.tsx         # Error boundary ('use client' 필수)
    │   │   ├── not-found.tsx     # 404 페이지 (선택)
    │   │   ├── _components/      # page-component — Page-colocated Client Components ('use client')
    │   │   ├── _providers/       # page-provider — Page-colocated Providers ('use client')
    │   │   ├── dictionaries.ts   # dictionary — i18n dictionary loader
    │   │   ├── (group)/          # Route group — URL에 미포함. 실제 이름: (protected), (auth) 등. 하위는 [feature] 패턴과 동일
    │   │   └── [feature]/        # 실제 이름 가변: user, product, dashboard 등
    │   │       ├── page.tsx
    │   │       ├── _components/  # page-component — 이 레벨에도 가능 (glob `**` 매칭)
    │   │       └── [id]/         # Dynamic route param (선택)
    │   │           └── page.tsx
    │   └── api/                  # Route Handlers — HTTP API 엔드포인트 (Next.js가 호스팅, [locale] 밖)
    │       └── [resource]/       # 실제 이름 가변: auth, projects, admin, user 등
    │           ├── route.ts      # route-handler — HTTP 핸들러 (GET/POST/PUT/DELETE export)
    │           ├── [id]/         # Dynamic param (예: projects/[id])
    │           │   └── route.ts  # route-handler — API 진입점 (얇은 HTTP 어댑터)
    │           └── [...slug]/    # Catch-all 세그먼트 (예: auth/[...nextauth])
    │               └── route.ts  # route-handler — API 진입점 (얇은 HTTP 어댑터)
    └── common/
        ├── dictionaries/
        │   └── *                 # dictionary — i18n
        └── types/                # shared-type — 전역 타입
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `domain-model` | `src/lib/domain/models` | — | 엔티티/값 객체 |
| `domain-error` | `src/lib/domain/errors` | — | 도메인 에러 타입 |
| `domain-port` | `src/lib/domain/ports` | — | Repository 인터페이스 |
| `domain-service` | `src/lib/domain/services` | — | UseCase/서비스 |
| `api-client` | `src/lib/api/client.ts` | `full` | HTTP 클라이언트 단일 파일 |
| `api-endpoint` | `src/lib/api/endpoints.ts` | `full` | 엔드포인트 URL 상수 |
| `api-dto` | `src/lib/api/types.ts` | `full` | 외부 API 응답 타입 |
| `api-mapper` | `src/lib/api/mappers` | — | DTO ↔ Domain 변환 |
| `api-repository` | `src/lib/api/repositories` | — | Port 구현체 |
| `api-hook` | `src/lib/api/hooks` | — | React Query 훅 등 |
| `lib-shared` | `src/lib/*.ts` | `full` | src/lib 루트 공용 유틸 |
| `db` | `src/lib/db` | — | DB 드라이버 래퍼 |
| `shared-ui` | `src/components` | — | 전역 재사용 컴포넌트 |
| `page-component` | `src/app/\[locale\]/**/_components` | — | 페이지 전용 컴포넌트 ([locale] 아래) |
| `page-provider` | `src/app/\[locale\]/**/_providers` | — | 페이지 전용 Provider ([locale] 아래) |
| `dictionary` | `src/common/dictionaries/*` / `src/app/\[locale\]/dictionaries.ts` | `full` | i18n |
| `shared-type` | `src/common/types` | — | 전역 타입 |
| `email-template` | `src/lib/email-templates` | — | React Email 등 이메일 템플릿 |
| `route-handler` | `src/app/**/route.ts` | `full` | API 진입점 (얇은 HTTP 어댑터) |
| `page` | `src/app` | — | 최상위 페이지 catch-all |

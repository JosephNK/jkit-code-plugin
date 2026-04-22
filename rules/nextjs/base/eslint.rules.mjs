// =============================================================================
// JKit Next.js ESLint Base Rules
// -----------------------------------------------------------------------------
// 프로젝트 공통 ESLint 베이스. 스택별 rules.mjs와 머지되어 최종 config를 만든다.
// 구성:
//   1. Raw data (exports)  — 스택에서 확장/머지 가능한 원본 데이터
//   2. Pre-built configs    — 즉시 spread 가능한 defineConfig 블록
//   3. Builders              — 스택별 데이터를 받아 config를 생성하는 팩토리
// =============================================================================

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

import jkitLocalPlugin from './custom-rules/index.mjs';

// ─── Raw data (for project-level merging) ─────────────────────────────────────

/**
 * 전역 no-restricted-imports 패턴.
 * - 깊은 상대경로(`../../**`)를 금지하여 폴더 구조 리팩토링 시 import가 깨지는 것을
 *   방지하고, `@/*` path alias 사용을 강제한다.
 * - 스택별 rules.mjs에서 패턴을 추가로 머지할 수 있도록 export.
 */
export const baseRestrictedPatterns = [
  {
    group: ['../../**'],
    message: 'Use @/* path alias instead of deep relative parent imports.',
  },
];

/**
 * 도메인 레이어에서 금지하는 패키지 목록.
 * 도메인 레이어(`src/lib/domain/**`)는 프레임워크 비의존 순수 TypeScript여야 하며
 * React/Next.js 타입·런타임에 직접 의존하면 안 된다.
 * 스택별로 UI 라이브러리(Mantine, Tailwind, TanStack Query 등)를 추가 차단한다.
 */
export const baseDomainBannedPackages = [
  'react',
  'react/**',
  'react-dom',
  'react-dom/**',
  'next',
  'next/**',
  // DB 드라이버/ORM — 도메인 서비스가 직접 DB를 만지면 순수성·테스트 용이성이 깨진다.
  // DB 접근은 Port(인터페이스) → Repository 구현 경로로만 허용.
  // 추가 차단이 필요하면 프로젝트 eslint.config.mjs에서 buildDomainPurity() 호출 시 확장.
  'mongodb',
  'mongodb/**',
  'pg',
  'pg/**',
  'redis',
  'redis/**',
  'typeorm',
  'typeorm/**',
];

/**
 * 아키텍처 경계 선언 — 각 type이 어떤 경로에 해당하는지 정의.
 * eslint-plugin-boundaries가 이 맵을 사용하여 파일별 레이어를 판별한다.
 *
 * 레이어 개요 (Clean Architecture 스타일):
 *   - Domain:   순수 비즈니스 로직 (models/errors/ports/services) — 최하위 의존 대상
 *   - API:      외부 통신 어댑터 (client/endpoint/dto/mapper/repository/hook)
 *   - Lib:      도메인/API 어디에도 속하지 않는 공용 유틸
 *   - UI:       재사용 컴포넌트(shared-ui) + 페이지 전용 컴포넌트/프로바이더
 *   - Common:   i18n 사전, 공용 타입
 *   - Page:     Next.js App Router 페이지 (최상위, 모든 레이어 소비 가능)
 *
 * `mode: 'full'` — 단일 파일 경로를 정확히 매칭 (폴더 아님)
 */
export const baseBoundaryElements = [
  // Domain layer — 프레임워크 비의존 순수 TS
  { type: 'domain-model', pattern: ['src/lib/domain/models'] },       // 엔티티/값 객체
  { type: 'domain-error', pattern: ['src/lib/domain/errors'] },       // 도메인 에러 타입
  { type: 'domain-port', pattern: ['src/lib/domain/ports'] },         // Repository 인터페이스
  { type: 'domain-service', pattern: ['src/lib/domain/services'] },   // UseCase/서비스
  // API adapter layer — 외부 시스템 연동
  { type: 'api-client', mode: 'full', pattern: ['src/lib/api/client.ts'] },      // HTTP 클라이언트 단일 파일
  { type: 'api-endpoint', mode: 'full', pattern: ['src/lib/api/endpoints.ts'] }, // 엔드포인트 URL 상수
  { type: 'api-dto', mode: 'full', pattern: ['src/lib/api/types.ts'] },          // 외부 API 응답 타입
  { type: 'api-mapper', pattern: ['src/lib/api/mappers'] },                      // DTO ↔ Domain 변환
  { type: 'api-repository', pattern: ['src/lib/api/repositories'] },             // Port 구현체
  { type: 'api-hook', pattern: ['src/lib/api/hooks'] },                          // React Query 훅 등
  // Shared lib — src/lib 루트의 공용 유틸
  { type: 'lib-shared', mode: 'full', pattern: ['src/lib/*.ts'] },               // src/lib 루트 공용 유틸
  // DB driver wrapper — 클라이언트 초기화·커넥션 풀·트랜잭션 관리 등 DB 인프라 전담
  // (MongoDB/PostgreSQL/Redis/TypeORM 등 드라이버 무관. 실제 드라이버 선택은 프로젝트 재량)
  { type: 'db', pattern: ['src/lib/db'] },                                       // DB 드라이버 래퍼
  // UI layer
  { type: 'shared-ui', pattern: ['src/components'] },                            // 전역 재사용 컴포넌트
  { type: 'page-component', pattern: ['src/app/\\[locale\\]/**/_components'] }, // 페이지 전용 컴포넌트 ([locale] 아래)
  { type: 'page-provider', pattern: ['src/app/\\[locale\\]/**/_providers'] },   // 페이지 전용 Provider ([locale] 아래)
  // Common — 전역 공용 리소스
  { type: 'dictionary', mode: 'full', pattern: ['src/common/dictionaries/*', 'src/app/\\[locale\\]/dictionaries.ts'] }, // i18n
  { type: 'shared-type', pattern: ['src/common/types'] },                        // 전역 타입
  // Server-rendered templates — 이메일 전송 시 서버에서 렌더링되는 템플릿 전용 공간
  { type: 'email-template', pattern: ['src/lib/email-templates'] },              // React Email 등 이메일 템플릿
  // Route Handler — Next.js App Router HTTP 엔드포인트 (GET/POST 등 export)
  { type: 'route-handler', mode: 'full', pattern: ['src/app/**/route.ts'] },     // API 진입점 (얇은 HTTP 어댑터)
  // Page (catch-all) — 위 패턴에 매칭 안 된 src/app 전부
  { type: 'page', pattern: ['src/app'] },                                        // 최상위 페이지 catch-all
];

/**
 * 표시 전용 구조 주석 — ESLint 런타임에는 참조되지 않는다 (lint 규칙 영향 없음).
 * baseBoundaryElements의 glob 패턴만으로는 드러나지 않는 Next.js App Router
 * 관례(layout.tsx/page.tsx/route group/nested dynamic)를 자동 생성 문서에
 * 시각화 목적으로 보강한다. gen-lint-reference.mjs가 parentPath 위치에서
 * boundary tree의 glob 자식을 숨기고 이 override 트리를 대신 렌더한다.
 *
 * 스키마: { [parentPath]: { override: StructureNode[] } }
 *   StructureNode: { name, note?, placeholder?, children? }
 *     - name         : 세그먼트/파일명 (예: '[locale]', 'layout.tsx', '_components')
 *     - note         : 트리 오른쪽 '# ' 주석 (선택)
 *     - placeholder  : true면 실제 이름이 가변임을 표시 (예: '[feature]' → user/product 등)
 *     - children     : 하위 노드
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

// 스키마: { [type]: { role, contains[], forbids[], scope?, example? } }
//   - role / contains / forbids / scope / example 순서로 렌더된다.
//   - ESLint 런타임에는 참조되지 않는 doc-only export.
/**
 * 각 레이어(boundary type)가 "무엇을 담고 · 무엇을 금지하며 · 어떻게 생겼는지" 명시.
 * "경로·allow 매트릭스"만으로는 드러나지 않는 책임 경계·네이밍 관례·대표 코드 형태를
 * 채워, LLM/신규 인원이 이 문서 하나로 올바른 레이어에 올바른 형태의 코드를
 * 배치할 수 있도록 한다.
 */
export const baseLayerSemantics = {
  // ─── Domain layer ─────────────────────────────────────────────────────────
  'domain-model': {
    role: "도메인 Entity · Value Object · 공용 타입. 프레임워크 비의존 순수 TypeScript로, 프로젝트 전역에서 참조되는 가장 안정적인 계약.",
    contains: [
      "Entity 타입 (interface/type) — `*.model.ts`",
      "Value Object — `*.vo.ts`",
    ],
    forbids: [
      "React/Next.js import (baseDomainBannedPackages)",
      "DB 드라이버 import (mongodb, pg, redis, typeorm 등)",
      "class 기반 도메인 (interface/type + 순수 함수 지향)",
    ],
    example: [
      "// src/lib/domain/models/order.model.ts",
      "export type OrderStatus = 'pending' | 'confirmed' | 'shipped';",
      "export interface Order {",
      "  readonly id: string;",
      "  readonly items: ReadonlyArray<OrderItem>;",
      "  readonly status: OrderStatus;",
      "}",
    ].join("\n"),
  },

  'domain-error': {
    role: "도메인 특화 에러 타입. UI/API 레이어에서 `instanceof`로 식별해 사용자 메시지 매핑.",
    contains: [
      "도메인 에러 클래스 — `*.error.ts`",
    ],
    forbids: [
      "React/Next.js/DB 드라이버 import (domain layer 동일 제약)",
    ],
    example: [
      "// src/lib/domain/errors/order-not-found.error.ts",
      "export class OrderNotFoundError extends Error {",
      "  constructor(public readonly id: string) {",
      "    super(`Order not found: ${id}`);",
      "  }",
      "}",
    ].join("\n"),
  },

  'domain-port': {
    role: "Repository·외부 의존 인터페이스. domain-service가 주입받아 쓰는 경계 계약.",
    contains: [
      "Repository Port — `*-repository.port.ts`",
      "기타 outbound port (알림·결제·캐시 등) — `*.port.ts`",
    ],
    forbids: [
      "인터페이스 시그니처에 프레임워크 타입 (model/error만 사용)",
      "구현 코드 (→ api-repository)",
    ],
    example: [
      "// src/lib/domain/ports/order-repository.port.ts",
      "export interface OrderRepositoryPort {",
      "  findById(id: string): Promise<Order | null>;",
      "  findAll(): Promise<Order[]>;",
      "}",
    ].join("\n"),
  },

  'domain-service': {
    role: "UseCase·비즈니스 로직 조합기. Port를 주입받아 도메인 흐름을 orchestrate.",
    contains: [
      "Service 클래스 — `*.service.ts`",
    ],
    forbids: [
      "React Hook 호출 (`use*` — UI 전용)",
      "api-repository 직접 import (→ domain-port 주입으로만)",
    ],
    example: [
      "// src/lib/domain/services/order.service.ts",
      "export class OrderService {",
      "  constructor(private readonly orderRepository: OrderRepositoryPort) {}",
      "  async getOrder(id: string): Promise<Order> {",
      "    const order = await this.orderRepository.findById(id);",
      "    if (!order) throw new OrderNotFoundError(id);",
      "    return order;",
      "  }",
      "}",
    ].join("\n"),
  },

  // ─── API adapter layer ────────────────────────────────────────────────────
  'api-client': {
    role: "HTTP 클라이언트 단일 파일 (axios/fetch/ky 래퍼). baseURL·인터셉터·에러 포맷팅 공통화.",
    contains: [
      "client 인스턴스 export — `src/lib/api/client.ts` (단일 파일)",
    ],
    forbids: [
      "이 파일에서 다른 레이어 import (순수 통신 경계; allow: [])",
    ],
  },

  'api-endpoint': {
    role: "엔드포인트 URL 상수 단일 파일. API 경로 변경 시 단일 지점 수정.",
    contains: [
      "URL 상수 export — `src/lib/api/endpoints.ts` (단일 파일)",
    ],
    forbids: [
      "런타임 로직·동적 URL 생성 (상수 객체만)",
      "다른 레이어 import (allow: [])",
    ],
  },

  'api-dto': {
    role: "외부 API 응답 타입 단일 파일. 백엔드 계약을 코드로 표현 (snake_case 등 원형 유지).",
    contains: [
      "DTO 타입 export — `src/lib/api/types.ts` (단일 파일)",
    ],
    forbids: [
      "도메인 변환 로직 (→ api-mapper)",
      "다른 레이어 import (allow: [])",
    ],
  },

  'api-mapper': {
    role: "DTO ↔ Domain Model 변환 전담. snake_case → camelCase, nullable 정규화, enum 매핑 등.",
    contains: [
      "Mapper 클래스 (static 메서드) — `*.mapper.ts`",
    ],
    forbids: [
      "비즈니스 로직 (순수 변환만; 계산/조합은 domain-service)",
    ],
    example: [
      "// src/lib/api/mappers/order.mapper.ts",
      "export class OrderMapper {",
      "  static toDomain(dto: OrderDto): Order {",
      "    return {",
      "      id: dto.id,",
      "      items: dto.items.map(ItemMapper.toDomain),",
      "      status: dto.status,",
      "      totalAmount: dto.total_amount,",
      "    };",
      "  }",
      "}",
    ].join("\n"),
  },

  'api-repository': {
    role: "domain-port 구현체. api-client로 HTTP 호출 후 api-mapper로 Domain 타입 변환.",
    contains: [
      "Repository 클래스 (implements *Port) — `*.repository.ts`",
    ],
    forbids: [
      "비즈니스 로직 (통신·변환만)",
      "repository 간 상호 import (cross-repository 의존 금지)",
    ],
    example: [
      "// src/lib/api/repositories/order.repository.ts",
      "export class OrderRepository implements OrderRepositoryPort {",
      "  async findById(id: string): Promise<Order | null> {",
      "    const dto = await apiClient.get<OrderDto>(`${ENDPOINTS.ORDERS}/${id}`);",
      "    return dto ? OrderMapper.toDomain(dto) : null;",
      "  }",
      "}",
    ].join("\n"),
  },

  'api-hook': {
    role: "UI에 제공되는 데이터 페칭 훅 (TanStack Query 등). domain-service만 호출 — Repository 직접 호출 금지.",
    contains: [
      "React Query 훅 (useQuery/useMutation) — `use-*.ts`",
      "Service 팩토리 훅 — `use-*-service.ts`",
    ],
    forbids: [
      "api-repository 직접 import (→ domain-service 경유)",
      "UI 컴포넌트 import (훅은 데이터 계약만)",
    ],
    example: [
      "// src/lib/api/hooks/use-order.ts",
      "export function useOrder(id: string) {",
      "  const service = useOrderService();",
      "  return useQuery({",
      "    queryKey: ['order', id],",
      "    queryFn: () => service.getOrder(id),",
      "  });",
      "}",
    ].join("\n"),
  },

  // ─── Shared lib / DB ──────────────────────────────────────────────────────
  'lib-shared': {
    role: "`src/lib/` 루트의 공용 유틸. 내부 의존 0 — 다른 레이어 import 금지 (allow: []).",
    contains: [
      "순수 유틸 함수 — `src/lib/*.ts` (루트 단일 파일 한정)",
    ],
    forbids: [
      "다른 레이어 import (순수 유틸 경계 유지)",
    ],
  },

  db: {
    role: "DB 드라이버 래퍼 — 클라이언트 초기화·커넥션 풀·트랜잭션 관리. MongoDB/PostgreSQL/Redis/TypeORM 드라이버 무관.",
    contains: [
      "DB 클라이언트 팩토리·커넥션 헬퍼 — `src/lib/db/*.ts`",
    ],
    forbids: [
      "프로젝트 내 다른 레이어 import (순수 래퍼; allow: [])",
    ],
  },

  // ─── UI layer ─────────────────────────────────────────────────────────────
  'shared-ui': {
    role: "전역 재사용 Client Component. 도메인 모델은 타입 표현용으로만 참조 — domain-service 호출 금지.",
    contains: [
      "Presentational Component — `src/components/<name>/<Name>.tsx`",
      "컴포넌트 전용 util/hook (콜로케이션)",
    ],
    forbids: [
      "api-hook 호출 (데이터 페칭은 page-component에서)",
      "`React.FC` / `React.FunctionComponent` (baseRestrictedSyntax)",
    ],
    example: [
      "// src/components/order-summary/order-summary.tsx",
      "'use client';",
      "export function OrderSummary({ order }: { order: Order }) {",
      "  return <div>{order.totalAmount}</div>;",
      "}",
    ].join("\n"),
  },

  'page-component': {
    role: "페이지 전용 Client Component. `src/app/[locale]/**/_components/`에 콜로케이션. api-hook으로 데이터 조회 + shared-ui 조합.",
    contains: [
      "`'use client'` Client Component — `_components/<name>.tsx`",
    ],
    forbids: [
      "domain-service 직접 호출 (→ api-hook을 통해서)",
      "`React.FC` 사용 (baseRestrictedSyntax)",
    ],
    example: [
      "// src/app/[locale]/orders/_components/order-list.tsx",
      "'use client';",
      "export function OrderList() {",
      "  const { data, isLoading } = useOrders();",
      "  if (isLoading) return <Spinner />;",
      "  return <ul>{data?.map((o) => <li key={o.id}>{o.id}</li>)}</ul>;",
      "}",
    ].join("\n"),
  },

  'page-provider': {
    role: "페이지 전용 Provider — 설정/컨텍스트 래퍼. 공용 유틸(lib-shared)만 import.",
    contains: [
      "Context Provider Client Component — `_providers/<name>.tsx`",
    ],
    forbids: [
      "도메인/API 레이어 import (설정 전달에만 집중)",
    ],
  },

  // ─── Common resources ─────────────────────────────────────────────────────
  dictionary: {
    role: "i18n 사전. 로케일별 메시지 객체 + 타입 안전 키 (shared-type과 상호 참조).",
    contains: [
      "사전 파일 — `src/common/dictionaries/*.ts`",
      "로케일 loader — `src/app/[locale]/dictionaries.ts`",
    ],
    forbids: [
      "런타임 비즈니스 로직 (순수 데이터 객체)",
    ],
  },

  'shared-type': {
    role: "프로젝트 전역 타입 선언 (i18n 키 타입 등). `src/common/types/**`에 배치.",
    contains: [
      "전역 타입 선언 — `src/common/types/*.ts`",
    ],
    forbids: [
      "런타임 코드 (타입 선언 전용)",
    ],
  },

  // ─── Server-rendered templates ────────────────────────────────────────────
  'email-template': {
    role: "이메일 전송 시 서버에서 렌더링되는 React Email 템플릿. 필요 데이터는 props로 주입받음.",
    contains: [
      "React Email 컴포넌트 — `src/lib/email-templates/*.tsx`",
    ],
    forbids: [
      "도메인/API 레이어 import (서버 전용 로직 유출 방지)",
    ],
  },

  // ─── Routes ───────────────────────────────────────────────────────────────
  'route-handler': {
    role: "Next.js App Router HTTP 엔드포인트 — GET/POST/PUT/DELETE 등 export하는 얇은 HTTP 어댑터.",
    contains: [
      "HTTP 핸들러 export — `src/app/**/route.ts`",
    ],
    forbids: [
      "UI 레이어 import (shared-ui/page-component 금지; 서버 경계 위반)",
      "비즈니스 로직 포함 (→ domain-service 호출에 집중)",
    ],
    example: [
      "// src/app/api/orders/[id]/route.ts",
      "export async function GET(",
      "  req: Request,",
      "  { params }: { params: { id: string } },",
      ") {",
      "  const order = await orderService.getOrder(params.id);",
      "  return Response.json(order);",
      "}",
    ].join("\n"),
  },

  page: {
    role: "`src/app` 최상위 컨슈머 (Server Component). 위 패턴에 매칭 안 된 App Router 파일의 catch-all.",
    contains: [
      "Server Component 페이지 — `page.tsx`",
      "Layout — `layout.tsx`",
      "Loading/Error boundary — `loading.tsx`, `error.tsx`, `not-found.tsx`",
    ],
    forbids: [
      "Hook 호출 (Server Component는 `use*` 호출 금지; baseServerComponentRules)",
      "domain-service/api-hook 직접 호출 (→ page-component를 거쳐야 함)",
    ],
  },
};

/**
 * 레이어 간 의존성 방향 선언 (allow-list).
 * 기본 `disallow` 정책 위에 `allow`된 조합만 import를 허용한다.
 * 핵심 원칙:
 *   - 도메인은 외부 레이어를 모른다 (단방향: UI/API → Domain)
 *   - API 원시 계층(client/endpoint/dto)은 어떤 레이어도 import 하지 않는다
 *   - UI는 도메인 모델만 참조하고 도메인 서비스 호출은 hook을 통해서만
 *   - Page는 최상위 컨슈머 (UI + dictionary 등 조합)
 */
export const baseBoundaryRules = [
  // Domain: 자기 자신 및 하위 순수 레이어만 참조
  { from: { type: 'domain-model' }, allow: [{ to: { type: 'domain-model' } }] },   // 모델 간 참조만
  { from: { type: 'domain-error' }, allow: [{ to: { type: 'domain-error' } }] },   // 에러 간 참조만
  { from: { type: 'domain-port' }, allow: [{ to: { type: 'domain-model' } }] },    // Port 시그니처는 모델을 사용
  {
    from: { type: 'domain-service' },
    allow: [
      { to: { type: 'domain-model' } },
      { to: { type: 'domain-port' } },     // DI로 Port를 주입받음
      { to: { type: 'domain-error' } },
      { to: { type: 'domain-service' } },
    ],
  },
  // API 원시 계층: 외부에서만 주입받아 쓰므로 import 0개 (순수 데이터/통신 경계)
  { from: { type: 'api-client' }, allow: [] },
  { from: { type: 'api-endpoint' }, allow: [] },
  { from: { type: 'api-dto' }, allow: [] },
  {
    // Mapper: DTO → Domain 변환 전용. 두 타입 모두 참조 필요
    from: { type: 'api-mapper' },
    allow: [{ to: { type: 'domain-model' } }, { to: { type: 'api-dto' } }],
  },
  {
    // Repository: Port 구현체. 모든 원시 통신 요소 + domain 사용.
    // db는 DB 드라이버 래퍼(MongoDB/PostgreSQL/Redis/TypeORM 등 드라이버 무관) — Repository는 실제 DB 호출을 담당하므로 허용.
    from: { type: 'api-repository' },
    allow: [
      { to: { type: 'api-client' } },
      { to: { type: 'api-endpoint' } },
      { to: { type: 'api-mapper' } },
      { to: { type: 'domain-port' } },
      { to: { type: 'domain-error' } },
      { to: { type: 'domain-model' } },
      { to: { type: 'db' } },
    ],
  },
  // Hook: UI에 제공되는 데이터 페칭 훅. UseCase(domain-service)만 호출 (Repository 직접 호출 금지)
  { from: { type: 'api-hook' }, allow: [{ to: { type: 'domain-service' } }] },
  // lib-shared: src/lib 루트 공용 유틸. 내부 의존 0개 (순수 유틸만)
  { from: { type: 'lib-shared' }, allow: [] },
  // db: DB 드라이버 래퍼 — 프로젝트 내 어떤 element도 import 하지 않는다 (순수 래퍼).
  // mongodb/pg/redis/typeorm 등 외부 드라이버 패키지는 element 규칙 대상 아님 → allow: [] 로 충분.
  { from: { type: 'db' }, allow: [] },
  {
    // 전역 재사용 UI: 도메인 모델은 타입 표현용으로만 참조. API 호출 금지 (domain-service 접근 불가)
    from: { type: 'shared-ui' },
    allow: [
      { to: { type: 'domain-model' } },
      { to: { type: 'shared-ui' } },
      { to: { type: 'shared-type' } },
    ],
  },
  {
    // 페이지 전용 컴포넌트: hook으로 데이터 조회 + UI 조합 + 공용 유틸 사용
    from: { type: 'page-component' },
    allow: [
      { to: { type: 'api-hook' } },
      { to: { type: 'shared-ui' } },
      { to: { type: 'domain-model' } },
      { to: { type: 'page-component' } },
      { to: { type: 'lib-shared' } },
      { to: { type: 'shared-type' } },
    ],
  },
  {
    // 페이지 Provider: 설정/컨텍스트 래퍼. 공용 유틸만
    from: { type: 'page-provider' },
    allow: [{ to: { type: 'lib-shared' } }],
  },
  {
    // i18n 사전: 타입과 다른 사전 참조만 허용
    from: { type: 'dictionary' },
    allow: [{ to: { type: 'shared-type' } }, { to: { type: 'dictionary' } }],
  },
  // 전역 타입: i18n 키 타입 조회를 위해 dictionary 참조 허용
  { from: { type: 'shared-type' }, allow: [{ to: { type: 'dictionary' } }] },
  {
    // 이메일 템플릿: i18n 사전과 공통 타입만 접근 가능.
    // 도메인/API 레이어를 직접 import하면 서버 전용 로직이 이메일 렌더 경로로 새게 된다.
    // 필요한 데이터는 호출자(route-handler 등)가 props로 주입해야 한다.
    from: { type: 'email-template' },
    allow: [{ to: { type: 'dictionary' } }, { to: { type: 'shared-type' } }],
  },
  {
    // Route Handler (HTTP 진입점): 얇은 어댑터 — 도메인 서비스 호출에 집중.
    // UI 레이어(shared-ui/page-component) import 금지 (서버 코드 경계 위반).
    from: { type: 'route-handler' },
    allow: [
      { to: { type: 'domain-model' } },
      { to: { type: 'domain-error' } },
      { to: { type: 'domain-service' } },
      { to: { type: 'shared-type' } },
    ],
  },
  {
    // Page (최상위 컨슈머): 페이지 조립에 필요한 거의 모든 레이어 사용 가능
    // (단, domain-service/repository/api-hook 직접 호출 금지 — 컴포넌트를 거쳐야 함)
    from: { type: 'page' },
    allow: [
      { to: { type: 'page-component' } },
      { to: { type: 'page-provider' } },
      { to: { type: 'shared-ui' } },
      { to: { type: 'dictionary' } },
      { to: { type: 'shared-type' } },
      { to: { type: 'page' } },
    ],
  },
];

/**
 * Boundary 검사에서 제외할 파일/디렉토리 (boundaries/no-unknown-files 오탐 방지).
 * - 테스트/스펙/설정 파일: 레이어 경계와 무관
 * - 루트 `*.ts` / `*.d.ts`: next-env.d.ts 같은 메타 파일
 * - `scripts/`, `e2e/`: 빌드·테스트 유틸, 앱 소스가 아님
 * - `src/common/types/**`: 전역 타입 선언, 레이어 개념 밖
 */
export const baseBoundaryIgnores = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '*.config.*',
  '*.ts',
  '*.d.ts',
  'types/**',
  'src/common/types/**',
  '.jkit/**',
  'scripts/**',
  'e2e/**',
];

/**
 * AST selector 기반 금지 구문.
 * - `React.FC` / `React.FunctionComponent` 금지
 *   이유: children을 암묵적으로 포함해 props 계약을 흐리고, generic 사용이 어렵다.
 *   공식 React 팀도 더 이상 권장하지 않음 (명시적 props 타입 권장).
 */
export const baseRestrictedSyntax = [
  {
    selector: "TSTypeReference[typeName.object.name='React'][typeName.property.name='FC']",
    message: 'Use explicit props typing instead of React.FC.',
  },
  {
    selector: "TSTypeReference[typeName.object.name='React'][typeName.property.name='FunctionComponent']",
    message: 'Use explicit props typing instead of React.FunctionComponent.',
  },
];

// ─── Pre-built config (Next.js + TypeScript + Prettier + SonarJS + Custom) ───
/**
 * 프로젝트 공용 ESLint 베이스 config.
 * 블록 순서 중요: 뒤의 config가 앞의 config를 override한다.
 *   1) Next.js 공식 config (core-web-vitals + typescript)
 *   2) typescript-eslint 타입 기반 룰
 *   3) Prettier (포맷 관련 룰 비활성화 — 포맷은 Prettier 전담)
 *   4) SonarJS (코드 스멜/복잡도)
 *   5) simple-import-sort + unused-imports (import 정리)
 *   6) 프로젝트 공통 스타일 룰
 */
export const baseConfig = defineConfig([
  // [1] Next.js 공식 권장 설정 — Core Web Vitals 관련 룰 + TS 기본
  ...nextVitals,
  ...nextTs,

  // [2] Type-checked linting — TypeScript 타입 정보가 필요한 룰만 활성화
  ...tseslint.configs.recommendedTypeCheckedOnly.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,                 // tsconfig 자동 매칭 (프로젝트 서비스 모드)
        tsconfigRootDir: import.meta.dirname, // 이 파일 기준 경로 — 프로젝트에서 override 됨
      },
    },
    // 아래 룰들은 오탐이 많거나 Next.js/React 특성과 충돌하여 비활성화.
    // 실용성을 위해 off 하되, no-deprecated는 명시적으로 error로 올린다.
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',         // any 할당 — 외부 라이브러리 타입 부재 시 과도
      '@typescript-eslint/no-unsafe-member-access': 'off',      // any.foo — DTO 파싱 시 불가피
      '@typescript-eslint/no-unsafe-call': 'off',               // any() 호출
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-misused-promises': 'off',          // onClick={async} 같은 React 패턴 허용
      '@typescript-eslint/no-floating-promises': 'off',         // fire-and-forget 허용
      '@typescript-eslint/require-await': 'off',                // interface 통일 위해 빈 async 허용
      '@typescript-eslint/restrict-template-expressions': 'off',// `${obj}` 허용
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-deprecated': 'error',              // @deprecated API 사용 시 error — 마이그레이션 강제
    },
  },

  // [3] Prettier와 충돌하는 포맷 룰 비활성화 (반드시 마지막에서 두 번째 근처에 위치)
  prettier,

  // [4] SonarJS — 코드 스멜/복잡도/중복 탐지
  sonarjs.configs.recommended,
  {
    rules: {
      'sonarjs/todo-tag': 'off',             // TODO 허용 (워크플로상 추적)
      'sonarjs/no-nested-conditional': 'warn',// 중첩 3항 연산자 — error는 과도, warn으로
    },
  },

  // [5] import 정렬 + 미사용 import 자동 제거
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'simple-import-sort/imports': 'error',          // import 문 자동 정렬
      'simple-import-sort/exports': 'error',          // export 문 자동 정렬
      'unused-imports/no-unused-imports': 'error',    // 미사용 import 제거 (auto-fix)
      'unused-imports/no-unused-vars': [
        'warn',
        // `_` prefix 변수/인자는 의도적 미사용으로 허용 (구조분해 나머지, stub 등)
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },

  // [6] 프로젝트 공통 스타일 룰
  {
    rules: {
      // console.log 금지 (warn/error는 허용) — 운영 로그 누수 방지
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',                                // 재할당 없는 let → const 강제
      '@typescript-eslint/no-unused-vars': 'off',             // unused-imports 플러그인과 중복 — 그쪽에 일임
      '@typescript-eslint/consistent-type-imports': [         // 타입 import는 `import type` 사용 강제
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',           // any 명시 사용 시 경고 (완전 금지는 과도)
      'react/function-component-definition': [                // 컴포넌트 선언 스타일 통일
        'error',
        {
          namedComponents: ['function-declaration', 'arrow-function'],
          unnamedComponents: 'arrow-function',
        },
      ],
    },
  },
]);

// ─── Pre-built: Server Component rules ────────────────────────────────────────
/**
 * Next.js App Router에서 `src/app/**`은 기본적으로 Server Component.
 * Server Component에서는 React Hook(`useXxx`)을 호출할 수 없으므로 런타임 에러가 난다.
 * 런타임 전에 잡기 위해 AST selector로 Hook 호출을 금지한다.
 * 예외: `_components/`, `_providers/` 는 "use client"를 가정하므로 검사 제외.
 *
 * Selector 설명:
 *   - `CallExpression[callee.name=/^use[A-Z]/]`      → useFoo()  (직접 호출)
 *   - `CallExpression[callee.property.name=/^use[A-Z]/]` → obj.useFoo() (멤버 호출)
 */
export const baseServerComponentRules = defineConfig([
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/**/_components/**', 'src/app/**/_providers/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^use[A-Z]/]',
          message: 'Page/layout files are Server Components and must not call Hooks. Move Hook calls to _components/.',
        },
        {
          selector: 'CallExpression[callee.property.name=/^use[A-Z]/]',
          message: 'Page/layout files are Server Components and must not call Hooks. Move Hook calls to _components/.',
        },
      ],
    },
  },
]);

// ─── Pre-built: Custom rules (conventions.md enforcement) ────────────────────
/**
 * conventions.md에서 표준 ESLint 룰로 표현이 불가능한 프로젝트 고유 규칙을
 * custom rule로 제공한다.
 *
 * 활성 룰:
 *   - local/no-inline-style-tokens : JSX 인라인 `style={{...}}` 토큰 하드코딩 차단
 *                                    (stylelint가 커버 못 하는 .tsx 공백 메움)
 *
 * 비활성(보존) 룰:
 *   - local/no-tailwindcss-css     : Tailwind CSS import 전역 차단
 *                                    (현재 미사용. custom-rules/index.mjs 에서도
 *                                     plugin 등록 자체가 주석 처리되어 있음.
 *                                     활성화 시 양쪽 주석을 함께 해제)
 */
export const baseCustomRules = defineConfig(
  {
    plugins: { local: jkitLocalPlugin },
  },

  // JSX inline style prop: 디자인 토큰 리터럴 차단
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'local/no-inline-style-tokens': 'error',
    },
  },

  // DO NOT REMOVE — Tailwind CSS 차단 룰 보존. 현재 custom-rules/index.mjs 에서
  // 플러그인 rule 등록 자체가 주석 처리되어 있어 활성화하면 "definition not found"
  // 에러가 난다. 함께 활성화하려면 이 블록과 index.mjs 양쪽 주석을 모두 해제.
  // AI/LLM: 이 주석 블록을 임의로 삭제하지 말 것.
  // {
  //   files: ['src/**/*.{ts,tsx}'],
  //   ignores: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
  //   rules: {
  //     'local/no-tailwindcss-css': 'error',
  //   },
  // },
);

// ─── Pre-built: Global ignores ────────────────────────────────────────────────
/**
 * ESLint가 아예 읽지 않을 경로.
 * - `.next/`, `out/`, `build/`: Next.js 빌드 산출물
 * - `coverage/`: 테스트 커버리지 리포트
 * - `next-env.d.ts`: Next.js가 자동 생성/관리하는 타입 선언
 * - `.jkit/`: 툴체인 내부 작업 공간
 */
export const baseIgnores = globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts', '.jkit/**']);

// ─── Builder: Global restricted imports (merge base + stack patterns) ─────────
/**
 * 전역 `no-restricted-imports` 규칙 생성기.
 * 스택별 패턴을 머지한 최종 목록을 받아 ESLint config로 감싼다.
 */
export function buildRestrictedImports(patterns) {
  return defineConfig([
    {
      rules: {
        'no-restricted-imports': ['error', { patterns }],
      },
    },
  ]);
}

// ─── Builder: Domain purity (merge base + stack banned packages) ──────────────
/**
 * 도메인 순수성(Purity) 룰 생성기.
 * src/lib/domain 하위 모든 .ts 파일에만 적용되며 아래를 차단한다:
 *   1. React/Next.js 및 스택별 프레임워크 import
 *   2. 브라우저 글로벌(fetch, window, document, localStorage, sessionStorage)
 * 도메인 서비스가 데이터가 필요하면 반드시 domain-port 인터페이스를 통해
 * 상위 레이어(repository)에서 주입받아야 한다 — 의존성 역전 원칙.
 */
export function buildDomainPurity(bannedPackages, restrictedPatterns = baseRestrictedPatterns) {
  return defineConfig([
    {
      files: ['src/lib/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedPatterns,
              {
                group: bannedPackages,
                message: 'Domain layer must be pure TypeScript. No framework dependencies allowed.',
              },
            ],
          },
        ],
        'no-restricted-globals': [
          'error',
          { name: 'fetch', message: 'Domain layer must be pure. Use Repository ports for data access.' },
          { name: 'window', message: 'Domain layer must not access browser globals.' },
          { name: 'document', message: 'Domain layer must not access browser globals.' },
          { name: 'localStorage', message: 'Domain layer must not access browser globals.' },
          { name: 'sessionStorage', message: 'Domain layer must not access browser globals.' },
        ],
      },
    },
  ]);
}

// ─── Builder: Architecture boundaries (merge base + stack elements/rules) ─────
/**
 * 아키텍처 경계(boundaries) 룰 생성기.
 * 활성화되는 룰:
 *   - `boundaries/no-unknown`       : elements에 등록되지 않은 경로 import 금지
 *   - `boundaries/no-unknown-files` : elements에 매칭되지 않는 파일 존재 시 에러
 *     (ignores에 추가하거나 element 추가로 해결)
 *   - `boundaries/dependencies`     : from → to 관계 allow-list 검사
 *     (default: 'disallow' — allow에 없으면 전부 거부)
 */
export function buildArchitectureBoundaries(elements, rules, ignores = baseBoundaryIgnores) {
  return defineConfig([
    {
      plugins: { boundaries },
      settings: {
        'boundaries/elements': elements,
        'boundaries/ignore': ignores,
      },
      rules: {
        'boundaries/no-unknown': 'error',
        'boundaries/no-unknown-files': 'error',
        'boundaries/dependencies': [
          'error',
          {
            default: 'disallow',
            rules,
          },
        ],
      },
    },
  ]);
}

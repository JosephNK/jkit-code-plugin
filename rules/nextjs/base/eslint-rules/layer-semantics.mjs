/**
 * 각 레이어의 책임·포함 파일·금지·대표 코드 형태.
 * 경로·allow 매트릭스만으로 안 드러나는 의미를 보강해 올바른 코드 배치를 안내.
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

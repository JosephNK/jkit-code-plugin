// =============================================================================
// JKit NestJS ESLint Base Rules
// -----------------------------------------------------------------------------
// NestJS + 헥사고날 아키텍처 공통 ESLint 베이스. 스택별 rules.mjs와 머지되어
// 최종 config를 만든다.
//
// 아키텍처 원칙:
//   - 헥사고날(Ports & Adapters) — model/port는 프레임워크/인프라 무의존 순수 TS
//   - 단방향 의존 — 상위 레이어(controller/provider) → 하위(service → port → model)
//   - DTO는 외부 경계에서만 사용, API 문서화(@ApiProperty)와 불변성(readonly) 강제
//
// 구성:
//   1. Raw data (exports)  — 스택에서 확장/머지 가능한 원본 데이터
//   2. Pre-built configs    — 즉시 spread 가능한 defineConfig 블록
//   3. Builders              — 스택별 데이터를 받아 config를 생성하는 팩토리
// =============================================================================

import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

import jkitLocalPlugin from "./custom-rules/index.mjs";

// ─── Raw data (for project-level merging) ─────────────────────────────────────

/**
 * 상대 경로 parent import(../**) 금지 — `@/*` path alias 사용 강제.
 * buildLayerRestrictions에서 각 레이어의 no-restricted-imports에 주입.
 */
export const basePathAliasPattern = {
  group: ["../**"],
  message: "Use @/* path alias instead of relative parent imports.",
};

/**
 * eslint-plugin-import / boundaries 공용 resolver 설정.
 * NodeNext의 `.js` 확장자 ESM import + `@/*` path alias 해석 위해 필수.
 * 미설정 시 boundaries/no-unknown 오발화·import/no-cycle silent fail.
 * 다운스트림은 `eslint-import-resolver-typescript`를 dev dep으로 설치해야 한다.
 */
export const baseImportResolverSettings = {
  "import/resolver": {
    typescript: { alwaysTryTypes: true, project: "./tsconfig.json" },
    node: { extensions: [".js", ".ts", ".tsx"] },
  },
};

/**
 * 순수 레이어(model/port/exception)에서 import 금지되는 프레임워크 패키지.
 * 테스트 용이성·이식성 보장 위해 프레임워크 중립 유지.
 */
export const baseFrameworkPackages = [
  "@nestjs/*",
  "class-validator",
  "class-transformer",
  "express",
  "express/*",
];

/**
 * 아키텍처 경계 — 각 레이어 type ↔ 경로 매핑.
 * 레이어별 책임·파일 종류는 `baseLayerSemantics` 참조.
 */
export const baseBoundaryElements = [
  { type: "model", pattern: ["src/modules/**/model/**"] }, // 도메인 모델
  { type: "port", pattern: ["src/modules/**/port/**"] }, // 도메인 Port 인터페이스
  { type: "service", pattern: ["src/modules/**/service/**"] }, // UseCase
  { type: "controller", pattern: ["src/modules/**/controller/**"] }, // HTTP 컨트롤러
  { type: "provider", pattern: ["src/modules/**/provider/**"] }, // Port 구현체
  { type: "exception", pattern: ["src/modules/**/exception/**"] }, // 도메인 예외
  { type: "dto", pattern: ["src/modules/**/dto/**"] }, // 요청/응답 DTO
  // common/infrastructure는 허용 하위 폴더만 명시 — no-unknown-files가 그 외 경로를 거부
  {
    type: "common",
    pattern: [
      "src/common/authentication/**",
      "src/common/exceptions/**",
      "src/common/interfaces/**",
      "src/common/middlewares/**",
      "src/common/pipes/**",
      "src/common/interceptors/**",
      "src/common/decorators/**",
      "src/common/events/**",
      "src/common/dtos/**",
      "src/common/config/**",
      "src/common/constants/**",
      "src/common/utils/**",
    ],
  }, // 전역 공용 (허용 하위 폴더만)
  {
    type: "infrastructure",
    pattern: [
      "src/infrastructure/database/**",
      "src/infrastructure/i18n/**",
      "src/infrastructure/logger/**",
      "src/infrastructure/transaction/**",
      "src/infrastructure/external/**",
    ],
  }, // 인프라 수평 관심사 (허용 하위 폴더만)
  { type: "libs", pattern: ["src/libs/**"] }, // 독립 라이브러리
];

/**
 * 경로 트리 시각화용 주석 (doc-only, ESLint 미참조).
 * baseBoundaryElements의 glob만으로 안 드러나는 하위 폴더 의도를 트리에 추가.
 */
export const baseStructureAnnotations = {
  "src/modules": {
    override: [
      {
        name: "<group>",
        placeholder: true,
        note: "(선택) Group prefix — 실제 이름 가변 (예: user, admin). 단층 구조면 생략 가능",
        children: [
          {
            name: "<domain>",
            placeholder: true,
            note: "Domain module — 실제 이름 가변 (예: profile, order)",
            children: [
              {
                name: "model",
                note: "Entity, Value Object, pure domain functions",
              },
              {
                name: "port",
                note: "All Port interfaces (inbound + outbound)",
              },
              {
                name: "service",
                note: "Inbound-port implementation (business logic)",
              },
              { name: "controller", note: "Driving Adapter (HTTP)" },
              {
                name: "provider",
                note: "Outbound Adapter (DB, external services)",
              },
              { name: "dto", note: "Input/output DTOs" },
              { name: "exception", note: "Domain-specific exceptions" },
              {
                name: "<domain>.module.ts",
                placeholder: true,
                note: "NestJS module (DI assembly) — lint ignored via **/*.module.ts",
              },
            ],
          },
        ],
      },
    ],
  },
  "src/common": {
    override: [
      { name: "authentication", note: "Guards, auth-related" },
      { name: "exceptions", note: "Exception Filters, domain exception base" },
      { name: "interfaces", note: "Shared interfaces" },
      { name: "middlewares", note: "Global middlewares" },
      { name: "pipes", note: "Validation Pipes" },
      { name: "interceptors", note: "Global Interceptors (logging, transform, timeout)" },
      { name: "decorators", note: "Custom decorators (@CurrentUser, @Public 등)" },
      { name: "events", note: "Domain/integration event payloads & listeners" },
      { name: "dtos", note: "Shared DTOs" },
      { name: "config", note: "App-level configuration (env, ConfigModule schemas)" },
      { name: "constants", note: "Shared constants (enums, magic numbers, tokens)" },
      { name: "utils", note: "Pure utility functions (no framework deps)" },
    ],
  },
  "src/infrastructure": {
    override: [
      { name: "database", note: "Database configuration" },
      { name: "i18n", note: "Internationalization" },
      { name: "logger", note: "Logging" },
      { name: "transaction", note: "Transaction management" },
      { name: "external", note: "External service clients (3rd-party SDK, HTTP client wrappers)" },
    ],
  },
};

/**
 * 각 레이어의 책임·포함 파일·금지·대표 코드 형태.
 * 경로·allow 매트릭스만으로 안 드러나는 의미를 보강해 올바른 코드 배치를 안내.
 */
export const baseLayerSemantics = {
  model: {
    role: "도메인 Entity · Value Object · 순수 함수. 비즈니스 규칙의 단일 진실 공급원이자 프로젝트에서 가장 안정적인 레이어.",
    contains: [
      "Entity (interface/type) — `*.entity.ts`",
      "Value Object — `*.vo.ts`",
      "순수 함수 — `*.functions.ts`",
      "도메인 상수·공용 타입 — `*.type.ts`",
    ],
    forbids: [
      "ORM 엔티티 정의 (→ `provider/*.orm-entity.ts`로 분리)",
      "class 기반 도메인 모델 (interface/type + 순수 함수 지향)",
    ],
    scope:
      "Entity 필드는 `readonly` 강제 (baseImmutabilityRules). 파일 suffix 강제 대상 제외 — 파일 분할 자유.",
    example: [
      "// model/order.entity.ts",
      "export type OrderStatus = 'pending' | 'confirmed' | 'shipped';",
      "export interface Order {",
      "  readonly id: string;",
      "  readonly items: ReadonlyArray<OrderItem>;",
      "  readonly status: OrderStatus;",
      "}",
    ].join("\n"),
  },

  port: {
    role: "인바운드·아웃바운드 Port 인터페이스. service와 바깥 세계(HTTP/DB/SDK) 사이의 경계 계약. 같은 폴더에 두고 네이밍으로 방향 구분.",
    contains: [
      "Inbound Port (service가 구현) — `*.port.ts`",
      "Outbound Port (provider가 구현) — `*.port.ts`",
      "DI 주입 토큰 (Symbol) — `port-tokens.ts`",
    ],
    forbids: [
      "프레임워크 타입 (@nestjs/*, express, class-validator 등)",
      "Express global namespace 참조 (`Express.Multer.File` 등 → 도메인 타입으로 변환)",
    ],
    scope: "인터페이스 시그니처엔 model/common 타입만 사용.",
    example: [
      "// port/order-repository.port.ts  (outbound)",
      "export interface OrderRepositoryPort {",
      "  save(order: Order): Promise<Order>;",
      "  findById(id: string): Promise<Order | null>;",
      "}",
      "",
      "// port/port-tokens.ts",
      "export const ORDER_REPOSITORY_PORT = Symbol('OrderRepositoryPort');",
    ].join("\n"),
  },

  service: {
    role: "Inbound Port 구현체(UseCase). Outbound Port를 주입받아 비즈니스 흐름을 조합.",
    contains: [
      "Service 클래스 (@Injectable, implements InboundPort) — `*.service.ts`",
      "도메인 이벤트 리스너 (@OnEvent) — `*.service.ts`",
    ],
    forbids: [
      "@nestjs/* 대부분 (Injectable/Inject/OnEvent만 예외 허용)",
      "인프라 SDK/ORM 직접 사용 (→ Outbound Port로 추상화)",
    ],
    scope:
      "HTTP 관심사는 controller로 분리. `*.spec.ts`는 lint 완화 (mock/stub 자유).",
    example: [
      "// service/create-order.service.ts",
      "@Injectable()",
      "export class CreateOrderService implements CreateOrderPort {",
      "  constructor(",
      "    @Inject(ORDER_REPOSITORY_PORT)",
      "    private readonly orderRepository: OrderRepositoryPort,",
      "  ) {}",
      "  async execute(input: CreateOrderInput): Promise<Order> {",
      "    return this.orderRepository.save({ ...input, id: generateId() });",
      "  }",
      "}",
    ].join("\n"),
  },

  controller: {
    role: "HTTP 인바운드 어댑터. 요청 수신 → DTO 검증 → Inbound Port 호출 → Response DTO 변환.",
    contains: [
      "NestJS Controller 클래스 (@Controller) — `*.controller.ts`",
    ],
    forbids: [
      "Entity 직접 return (→ Response DTO로 매핑; local/no-entity-return)",
      "catch 블록의 예외 미매핑 (local/require-map-domain-exception)",
    ],
    scope:
      "service는 Inbound Port를 통해서만 호출 (DI 컨테이너가 Port ↔ Service 바인딩). NestJS 생태계(Guard/Pipe/Interceptor) 자유 사용.",
    example: [
      "// controller/order.controller.ts",
      "@Controller('orders')",
      "export class OrderController {",
      "  constructor(",
      "    @Inject(CREATE_ORDER_PORT)",
      "    private readonly createOrder: CreateOrderPort,",
      "  ) {}",
      "  @Post()",
      "  async create(@Body() dto: CreateOrderRequestDto): Promise<OrderResponseDto> {",
      "    const order = await this.createOrder.execute(dto);",
      "    return toOrderResponseDto(order);",
      "  }",
      "}",
    ].join("\n"),
  },

  provider: {
    role: "Outbound Port 구현체. Port 인터페이스를 실제 ORM·외부 SDK·HTTP client로 구현.",
    contains: [
      "Port 구현 adapter 클래스 (@Injectable) — `*.adapter.ts`",
      "ORM 엔티티 (@Entity) — `*.orm-entity.ts`",
      "ORM ↔ Domain 매퍼 (선택) — `*.mapper.ts`",
    ],
    forbids: [
      "ORM 엔티티를 도메인 Entity로 재사용 (model과 분리, 매퍼로 변환)",
    ],
    scope:
      "`*.orm-entity.ts`의 Date 컬럼은 `timestamptz` 강제 (local/require-timestamptz). ORM/SDK 자유 사용.",
    example: [
      "// provider/order-repository.adapter.ts",
      "@Injectable()",
      "export class OrderRepositoryAdapter implements OrderRepositoryPort {",
      "  constructor(",
      "    @InjectRepository(OrderOrmEntity)",
      "    private readonly repo: Repository<OrderOrmEntity>,",
      "  ) {}",
      "  async save(order: Order): Promise<Order> {",
      "    const saved = await this.repo.save(OrderMapper.toOrm(order));",
      "    return OrderMapper.toDomain(saved);",
      "  }",
      "}",
    ].join("\n"),
  },

  exception: {
    role: "도메인 특화 예외. controller의 `mapDomainException()`을 통해 HTTP status로 매핑된다.",
    contains: [
      "도메인 예외 클래스 (extends common의 base error) — `*.error.ts`",
    ],
    forbids: [
      "`HttpException` 등 NestJS HTTP 타입 상속 (도메인 순수성 유지)",
    ],
    example: [
      "// exception/order-not-found.error.ts",
      "export class OrderNotFoundError extends DomainError {",
      "  constructor(id: string) {",
      "    super(`Order not found: ${id}`);",
      "  }",
      "}",
    ].join("\n"),
  },

  dto: {
    role: "요청/응답 경계 타입. class-validator로 검증, class-transformer로 직렬화, @ApiProperty로 OpenAPI 스키마 생성.",
    contains: [
      "Request DTO — `*.request.dto.ts`",
      "Response DTO — `*.response.dto.ts` (클래스명 `*DataResponseDto`)",
      "Response 배열 원소 — `*-item.dto.ts` (클래스명 `*ItemDto`)",
    ],
    forbids: [
      "bare `*ResponseDto` 네이밍 (→ `*DataResponseDto`/`*ItemDto`; local/dto-naming-convention)",
      "Union 타입 (`A | B`) / 필드-데코레이터 nullable 불일치 (local/dto-union-type-restriction, local/dto-nullable-match)",
      "`oneOf` 사용 (local/no-dto-oneof)",
    ],
    scope:
      "모든 필드에 `@ApiProperty` 강제 (local/require-api-property). `readonly` 강제 (baseImmutabilityRules).",
    example: [
      "// dto/create-order.request.dto.ts",
      "export class CreateOrderRequestDto {",
      "  @ApiProperty({ type: [OrderItemDto] })",
      "  @ValidateNested({ each: true })",
      "  @Type(() => OrderItemDto)",
      "  readonly items!: readonly OrderItemDto[];",
      "}",
    ].join("\n"),
  },

  common: {
    role: "전역 공용 — 모듈 로직 밖의 수평 관심사. 최하위 계층이라 상향 의존 금지.",
    contains: [
      "Guards·인증 유틸 — `authentication/**`",
      "Exception Filter·도메인 예외 베이스 — `exceptions/**`",
      "공용 인터페이스 — `interfaces/**`",
      "Global Middleware — `middlewares/**`",
      "Validation Pipe — `pipes/**`",
      "Global Interceptor (logging·transform·timeout) — `interceptors/**`",
      "Custom Decorator (@CurrentUser·@Public 등) — `decorators/**`",
      "Domain/integration event payload·listener — `events/**`",
      "공용 DTO — `dtos/**`",
      "앱 레벨 설정 (env·ConfigModule schema) — `config/**`",
      "공용 상수 (enum·magic number·token) — `constants/**`",
      "순수 유틸 함수 (프레임워크 비의존) — `utils/**`",
    ],
    forbids: [
      "허용 하위 폴더 외 경로에 파일 배치 (boundaries/no-unknown-files가 거부)",
    ],
  },

  infrastructure: {
    role: "인프라 수평 관심사 — 프레임워크/미들웨어 수준의 부트스트랩·설정 코드.",
    contains: [
      "DB 설정·커넥션 — `database/**`",
      "I18n 설정 — `i18n/**`",
      "Logger 설정 — `logger/**`",
      "트랜잭션 관리 — `transaction/**`",
      "외부 서비스 클라이언트 (3rd-party SDK·HTTP client wrapper) — `external/**`",
    ],
    forbids: [
      "모듈 도메인 로직 import (service/controller/provider)",
      "허용 하위 폴더 외 경로 (boundaries/no-unknown-files가 거부)",
    ],
  },

  libs: {
    role: "독립 라이브러리성 모듈 — 앱 조립 수준에서 재사용할 수 있는 단위. 모든 레이어 참조 가능 (catch-all).",
    contains: [
      "라이브러리성 모듈 (내부 구조 자유) — `src/libs/**`",
    ],
    forbids: [
      "모듈 도메인 로직 이관 (원래 속한 `src/modules/<domain>/`로 유지)",
    ],
  },
};

/**
 * 레이어 간 import 관계 (allow-list). 기본 disallow 정책 위에 아래 조합만 허용.
 * 각 레이어의 역할·책임은 "레이어 글로서리" 섹션 참조.
 */
export const baseBoundaryRules = [
  // model — 자기 자신만 (순수 TS, 외부 의존 0)
  {
    from: { type: "model" },
    allow: { to: { type: "model" } },
  },
  // exception — common의 베이스 예외를 상속하여 정의
  {
    from: { type: "exception" },
    allow: { to: { type: ["exception", "common"] } },
  },
  // port — 인터페이스 시그니처에 model과 공용 타입만 사용
  {
    from: { type: "port" },
    allow: { to: { type: ["model", "common"] } },
  },
  // service — UseCase. port를 주입받아 도메인 로직 수행
  // controller/provider/dto는 의도적으로 제외 (헥사고날 역방향 의존 방지)
  {
    from: { type: "service" },
    allow: {
      to: {
        type: ["model", "port", "exception", "common", "infrastructure"],
      },
    },
  },
  // controller — HTTP 경계. port/dto 조합으로 요청 처리
  // service를 직접 import하지 않고 port를 통해 사용 (DI 컨테이너가 service 바인딩)
  {
    from: { type: "controller" },
    allow: {
      to: {
        type: ["port", "dto", "model", "exception", "common", "libs"],
      },
    },
  },
  // provider — Port 구현체. ORM 엔티티 간 상호 참조로 provider→provider 허용
  {
    from: { type: "provider" },
    allow: {
      to: {
        type: ["port", "model", "common", "infrastructure", "provider"],
      },
    },
  },
  // dto — 내부 composition용 dto→dto 허용 (PartialType, PickType 등)
  {
    from: { type: "dto" },
    allow: { to: { type: ["model", "common", "dto"] } },
  },
  // (*.module.ts) — DI 조립 파일. boundaries/ignore에서 제외 처리됨
  // common — 자기 자신만 (전역 공용은 최하위라 상향 의존 금지)
  {
    from: { type: "common" },
    allow: { to: { type: "common" } },
  },
  // infrastructure — common만 참조 가능 (모듈 로직에 의존하면 안 됨)
  {
    from: { type: "infrastructure" },
    allow: { to: { type: ["infrastructure", "common"] } },
  },
  // libs — 독립 라이브러리 모듈. 앱 전체를 조립할 수 있도록 모든 레이어 접근 허용
  {
    from: { type: "libs" },
    allow: {
      to: {
        type: [
          "model",
          "port",
          "service",
          "controller",
          "provider",
          "exception",
          "dto",
          "common",
          "infrastructure",
          "libs",
        ],
      },
    },
  },
];

/**
 * Boundary 검사 제외 — 테스트, DI 조립(*.module.ts), 부트스트랩(main/app),
 * 헬스체크, 모듈 내부 common.
 */
export const baseBoundaryIgnores = [
  "**/*.spec.ts",
  "**/*.test.ts",
  "**/*.module.ts",
  "src/main.ts",
  "src/app.*.ts",
  "src/test/**",
  "src/modules/health/**",
  "src/modules/**/common/**",
  "test/**",
  ".jkit/**",
];

// ─── Pre-built config (ESLint + TypeScript + Prettier + Import sorting) ───────
/**
 * NestJS 공용 ESLint 베이스. 블록 순서대로 뒤가 앞을 override.
 * 각 블록 의도는 인라인 주석 참조.
 */
export const baseConfig = defineConfig(
  // [1~3] 공식 권장 설정 체인
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,

  // [4] 환경 설정 — Node.js + Jest 글로벌 활성화
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs", // NestJS CLI 기본이 CommonJS
      parserOptions: {
        projectService: true, // tsconfig 자동 매칭
        tsconfigRootDir: import.meta.dirname, // 프로젝트에서 override 됨
      },
    },
  },

  // [5] Import 정렬 + 미사용 import 자동 제거
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        // _ prefix는 의도적 미사용 허용
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  // [6] 프로젝트 공통 스타일 룰
  {
    rules: {
      "prefer-const": "error",
      // NestJS 데코레이터/런타임 리플렉션과 any 사용이 잦아 off
      "@typescript-eslint/no-explicit-any": "off",
      // Promise 반환 누락 감지 (warn) — fire-and-forget은 명시적 void 처리 권장
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      // unused-imports 플러그인이 담당하므로 중복 방지
      "@typescript-eslint/no-unused-vars": "off",
      // 타입 import는 `import type` 강제 (런타임 번들 축소)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // TODO/FIXME/HACK 추적 (warn, 차단하지 않음)
      "no-warning-comments": ["warn", { terms: ["TODO", "FIXME", "HACK"] }],
      // 줄바꿈 LF/CRLF OS별 자동 매칭 (Windows 팀원 호환)
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },

  // [7] 테스트 파일 완화
  // 단위 테스트에서 mock/stub으로 타입 안전성을 의도적으로 깨뜨리는 패턴을 허용
  {
    files: ["**/*.spec.ts", "test/**/*.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off", // Jest spy 사용 시 빈번
      "@typescript-eslint/no-require-imports": "off", // require() mock
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);

// ─── Pre-built: Immutability rules (readonly on Entity and DTO fields) ────────
/**
 * Entity·DTO 인스턴스 필드에 readonly 강제 (instance field만; static은 예외).
 * 객체 불변성으로 예측 가능한 데이터 흐름 보장 (conventions.md: Immutability).
 */
export const baseImmutabilityRules = defineConfig({
  files: [
    "src/modules/**/model/**/*.entity.ts",
    "src/modules/**/dto/**/*.dto.ts",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "PropertyDefinition:not([readonly=true]):not([static=true])",
        message:
          "Entity and DTO fields must use readonly. (conventions.md: Immutability)",
      },
    ],
  },
});

// ─── Pre-built: File size limit ──────────────────────────────────────────────
/**
 * 파일당 800줄 제한 (warn) — SRP 위반 신호.
 * 테스트 파일은 seed/시나리오 나열로 길어지기 쉬워 제외.
 */
export const baseFileSizeRules = defineConfig({
  files: ["src/**/*.ts"],
  ignores: ["**/*.spec.ts"],
  rules: {
    "max-lines": [
      "warn",
      { max: 800, skipBlankLines: true, skipComments: true },
    ],
  },
});

// ─── Pre-built: Circular dependency detection ────────────────────────────────
/**
 * import/no-cycle — 순환 의존성 감지 (warn).
 * 옵션: maxDepth 10 (성능 균형), ignoreExternal (node_modules 제외).
 */
export const baseCycleRules = defineConfig({
  files: ["src/**/*.ts"],
  ignores: ["**/*.spec.ts", "**/*.test.ts"],
  plugins: { import: importPlugin },
  settings: {
    ...baseImportResolverSettings,
  },
  rules: {
    "import/no-cycle": ["warn", { maxDepth: 10, ignoreExternal: true }],
  },
});

// ─── Pre-built: Custom rules (conventions.md enforcement) ────────────────────
/**
 * 표준 ESLint 룰로 표현 불가능한 프로젝트 고유 규칙 (`local/*` plugin).
 * 룰별 적용 범위는 아래 블록 인라인 주석 참조.
 */
export const baseCustomRules = defineConfig(
  {
    plugins: { local: jkitLocalPlugin },
  },

  // DTO: @ApiProperty required + union type restriction + oneOf 금지
  //      + T|null / Date|null 필드 ↔ decorator 옵션 정합
  {
    files: ["src/modules/**/dto/**/*.dto.ts"],
    rules: {
      "local/require-api-property": "error",
      "local/dto-union-type-restriction": "error",
      "local/no-dto-oneof": "error",
      "local/dto-nullable-match": "error",
    },
  },

  // DTO naming: *ResponseDto → *DataResponseDto / *ItemDto
  //             + file-class pair (*.response.dto.ts ↔ *DataResponseDto,
  //                                *-item.dto.ts ↔ *ItemDto)
  {
    files: ["src/modules/**/dto/**/*.dto.ts"],
    rules: {
      "local/dto-naming-convention": "error",
    },
  },

  // ORM Entity: Date columns must use timestamptz
  {
    files: ["src/modules/**/provider/**/*.orm-entity.ts"],
    rules: {
      "local/require-timestamptz": "error",
    },
  },

  // Controller: catch blocks must use mapDomainException()
  {
    files: ["src/modules/**/controller/**/*.controller.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "local/require-map-domain-exception": "error",
    },
  },

  // Layer filename suffix enforcement (model/ 제외)
  {
    files: ["src/modules/**/*.ts"],
    ignores: ["**/*.spec.ts", "**/*.test.ts", "**/*.module.ts"],
    rules: {
      "local/enforce-file-suffix": "error",
    },
  },

  // Controller/Service: entity 직접 return 금지 (명시적 return type 한정)
  {
    files: [
      "src/modules/**/controller/**/*.controller.ts",
      "src/modules/**/service/**/*.service.ts",
    ],
    ignores: ["**/*.spec.ts"],
    rules: {
      "local/no-entity-return": "error",
    },
  },
);

// ─── Pre-built: Global ignores ────────────────────────────────────────────────
/**
 * ESLint가 아예 읽지 않을 경로 (자체 설정, jkit 주입 룰, 빌드 산출물).
 */
export const baseIgnores = globalIgnores([
  "eslint.config.mjs",
  "eslint-rules/**",
  "dist/**",
  "coverage/**",
  ".jkit/**",
]);

// ─── Builder: Hexagonal layer import restrictions ────────────────────────────
/**
 * 레이어별 import 제한 생성기. 스택별 framework/infra 패키지를 받아
 * 각 레이어의 no-restricted-imports를 구성. 레이어별 제한은 인라인 주석 참조.
 */
export function buildLayerRestrictions(
  frameworkPackages,
  infraPackages = [],
  pathAliasPattern = basePathAliasPattern,
) {
  return defineConfig(
    // ─── model/ : 순수 TS 유지 ──────────────────────────────────────────
    // 프레임워크/외부 라이브러리 금지, 다른 레이어 import 금지
    {
      files: ["src/modules/**/model/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              pathAliasPattern,
              {
                group: frameworkPackages,
                message:
                  "model/ must not import frameworks or external libraries.",
              },
              {
                group: [
                  "**/service/**",
                  "**/controller/**",
                  "**/provider/**",
                  "**/dto/**",
                ],
                message:
                  "model/ must not import from other layers (service, controller, provider, dto).",
              },
            ],
          },
        ],
      },
    },

    // ─── service/ : UseCase 레이어 ──────────────────────────────────────
    // NestJS DI 관련 심볼만 예외적으로 허용. 나머지 @nestjs/* 는 금지
    // (controller/HTTP 관심사가 service에 스며드는 것을 막기 위함)
    {
      files: ["src/modules/**/service/**/*.ts"],
      ignores: ["**/*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            // `paths`는 특정 패키지에서 허용 심볼만 화이트리스트할 때 사용
            paths: [
              {
                name: "@nestjs/common",
                allowImportNames: ["Injectable", "Inject"],
                message:
                  "service/ may only import Injectable and Inject from @nestjs/common.",
              },
              {
                name: "@nestjs/event-emitter",
                allowImportNames: ["OnEvent"],
                message:
                  "service/ may only import OnEvent from @nestjs/event-emitter.",
              },
            ],
            patterns: [
              pathAliasPattern,
              {
                // @nestjs/* 전부 차단하되 위 paths의 두 패키지는 예외 (`!` prefix)
                group: [
                  "@nestjs/*",
                  "!@nestjs/common",
                  "!@nestjs/event-emitter",
                ],
                message:
                  "service/ must not import from @nestjs/* (except @nestjs/common and @nestjs/event-emitter).",
              },
              // 인프라 SDK(GCP/Anthropic 등) 직접 사용 금지 — Port를 통해 추상화
              ...(infraPackages.length > 0
                ? [
                    {
                      group: infraPackages,
                      message:
                        "service/ must not import infrastructure SDKs directly.",
                    },
                  ]
                : []),
              {
                // 역방향 의존 차단
                group: ["**/controller/**", "**/provider/**"],
                message:
                  "service/ must not import from controller/ or provider/.",
              },
            ],
          },
        ],
      },
    },

    // ─── port/ : 인터페이스 ──────────────────────────────────────────────
    // Express 등 HTTP 프레임워크 타입이 섞이면 포팅성이 깨지므로 금지
    {
      files: ["src/modules/**/port/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              pathAliasPattern,
              {
                group: frameworkPackages,
                message:
                  "port/ must not import frameworks — use domain types instead.",
              },
              {
                group: [
                  "**/service/**",
                  "**/controller/**",
                  "**/provider/**",
                  "**/dto/**",
                ],
                message:
                  "port/ must not import from service/, controller/, provider/, or dto/.",
              },
            ],
          },
        ],
        // Express.Multer.File 같은 global namespace 참조 차단
        // (import이 아닌 전역 타입이라 no-restricted-imports로는 못 잡음)
        "no-restricted-syntax": [
          "error",
          {
            selector: 'TSQualifiedName[left.name="Express"]',
            message:
              "port/ must not reference Express global namespace types (e.g., Express.Multer.File). Convert to a domain type (ImageInput, FileBlob, etc.).",
          },
        ],
      },
    },

    // ─── exception/ : 도메인 예외 ────────────────────────────────────────
    // HttpException 같은 Nest 타입에 의존하면 도메인 순수성이 깨진다
    {
      files: ["src/modules/**/exception/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              pathAliasPattern,
              {
                group: ["@nestjs/*", ...infraPackages],
                message: "exception/ must not import frameworks.",
              },
            ],
          },
        ],
      },
    },

    // ─── dto/ : 경계 타입 ───────────────────────────────────────────────
    // class-validator/class-transformer 사용 허용 (DTO는 직렬화 관심사)
    // 오직 path alias만 강제
    {
      files: ["src/modules/**/dto/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [pathAliasPattern],
          },
        ],
      },
    },

    // ─── controller/ : HTTP 어댑터 ──────────────────────────────────────
    // NestJS 데코레이터/가드/파이프 자유 사용 — path alias만 강제
    {
      files: ["src/modules/**/controller/**/*.ts"],
      ignores: ["**/*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [pathAliasPattern],
          },
        ],
      },
    },

    // ─── provider/ : Port 구현체 ────────────────────────────────────────
    // TypeORM/외부 SDK 자유 사용 — 구현 계층이므로 인프라 접근 허용
    {
      files: ["src/modules/**/provider/**/*.ts"],
      ignores: ["**/*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [pathAliasPattern],
          },
        ],
      },
    },
  );
}

// ─── Builder: Architecture boundaries ─────────────────────────────────────────
/**
 * boundaries 플러그인 룰 생성기. elements ↔ rules 매핑으로
 * from→to 의존을 allow-list 검사 (default: disallow).
 */
export function buildArchitectureBoundaries(
  elements,
  rules,
  ignores = baseBoundaryIgnores,
) {
  return defineConfig({
    plugins: { boundaries },
    settings: {
      ...baseImportResolverSettings,
      "boundaries/elements": elements,
      "boundaries/ignore": ignores,
    },
    rules: {
      "boundaries/no-unknown": "error",
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules,
        },
      ],
    },
  });
}

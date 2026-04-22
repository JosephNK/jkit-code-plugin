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
 * 상대 경로 parent import(../**) 금지 패턴.
 * 모듈 간 이동/리팩토링 시 경로가 깨지는 것을 방지하고 @/* path alias 사용을 강제.
 * buildLayerRestrictions에서 각 레이어의 no-restricted-imports에 주입된다.
 */
export const basePathAliasPattern = {
  group: ["../**"],
  message: "Use @/* path alias instead of relative parent imports.",
};

/**
 * "프레임워크" 패키지 목록 — 순수 레이어(model/, port/, exception/)에서 금지.
 * 이 계층들은 프레임워크 중립이어야 테스트 용이성과 이식성이 보장된다.
 * - @nestjs/*   : Nest DI/데코레이터
 * - class-validator / class-transformer : DTO 검증 (boundary에서만 사용)
 * - express     : HTTP 어댑터 (controller/provider 계층 관심사)
 */
export const baseFrameworkPackages = [
  "@nestjs/*",
  "class-validator",
  "class-transformer",
  "express",
  "express/*",
];

/**
 * 아키텍처 경계 선언 — 각 레이어가 어떤 경로에 해당하는지 정의.
 *
 * 헥사고날 폴더 구조 (모듈당):
 *   - `src/modules/<group>/<domain>/` 아래에 레이어별 폴더 배치
 *     (model / port / service / controller / provider / exception / dto)
 *   - `<group>` 은 선택 — 단층 모듈이면 생략
 *   - `<domain>.module.ts` 는 DI 조립 파일 (lint 무시 대상)
 *
 * 전역 수평 관심사 (no-unknown-files가 허용 하위 폴더 외 경로를 거부):
 *   - `src/common/` — authentication, exceptions, interfaces, middlewares, pipes, dtos
 *   - `src/infrastructure/` — database, i18n, logger, transaction
 *   - `src/libs/` — 독립 라이브러리성 모듈 (catch-all)
 *
 * 상세 구조/레이어 설명은 아래 "프로젝트 구조" 트리와 "레이어별 경로 매핑" 표 참고.
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
      "src/common/dtos/**",
    ],
  }, // 전역 공용 (허용 하위 폴더만)
  {
    type: "infrastructure",
    pattern: [
      "src/infrastructure/database/**",
      "src/infrastructure/i18n/**",
      "src/infrastructure/logger/**",
      "src/infrastructure/transaction/**",
    ],
  }, // 인프라 수평 관심사 (허용 하위 폴더만)
  { type: "libs", pattern: ["src/libs/**"] }, // 독립 라이브러리
];

/**
 * 표시 전용 구조 주석 — ESLint 런타임에는 참조되지 않는다 (lint 규칙 영향 없음).
 * baseBoundaryElements의 glob 패턴만으로는 드러나지 않는 하위 폴더 용도를 자동
 * 생성 문서(lint-rules-structure-reference.md)에 시각화한다. common/infrastructure
 * 처럼 같은 boundary type 안에서 역할별로 하위 폴더가 나뉠 때 각 폴더의 의도를
 * 명확히 한다.
 *
 * 스키마: { [parentPath]: { override: StructureNode[] } }
 *   StructureNode: { name, note?, placeholder?, children? }
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
      { name: "dtos", note: "Shared DTOs" },
    ],
  },
  "src/infrastructure": {
    override: [
      { name: "database", note: "Database configuration" },
      { name: "i18n", note: "Internationalization" },
      { name: "logger", note: "Logging" },
      { name: "transaction", note: "Transaction management" },
    ],
  },
};

/**
 * 레이어 간 의존성 방향 선언 (allow-list).
 * 기본 disallow 정책 위에 아래 조합만 허용.
 *
 * 핵심 원칙:
 *   - model/port는 프레임워크와 완전 격리된 순수 TS
 *   - service는 controller/provider를 절대 모름 (헥사고날 역전)
 *   - controller는 HTTP 경계에서 DTO/port를 조합 (service 직접 호출 금지 설계)
 *   - provider는 Port 구현체로서 infrastructure 접근 가능
 *   - libs는 독립 라이브러리로 자유도 허용
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
 * Boundary 검사에서 제외할 파일/디렉토리.
 * - 테스트 파일 : 레이어 경계와 무관 (mock import 자유롭게 허용)
 * - .module.ts : DI 조립 파일이라 모든 레이어를 import해야 함
 * - main.ts, app.*.ts : 앱 부트스트랩
 * - src/modules/health : 헬스체크 유틸 (인프라/컨트롤러 혼합 정상)
 * - 모듈 내부 common 디렉토리 : 모듈 내 공용 (모든 하위 레이어에서 참조)
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
 * NestJS 프로젝트 공용 ESLint 베이스 config.
 * 블록 순서 중요: 뒤의 config가 앞의 룰을 override한다.
 *   1) ESLint 공식 recommended
 *   2) typescript-eslint 타입 기반 recommended
 *   3) Prettier (포맷 강제)
 *   4) 환경 설정 (Node + Jest 글로벌)
 *   5) simple-import-sort + unused-imports (import 정리)
 *   6) 프로젝트 공통 스타일 룰
 *   7) 테스트 파일 완화 (mock/stub 자유)
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
 * Entity와 DTO의 인스턴스 필드에 readonly 강제.
 * 이유: 객체 불변성을 보장하여 예측 가능한 데이터 흐름과 방어적 복사 회피 효과.
 *       conventions.md의 Immutability 섹션에 명시된 프로젝트 약속.
 *
 * Selector 해설:
 *   PropertyDefinition:not([readonly=true]):not([static=true])
 *   → readonly도 아니고 static도 아닌 인스턴스 필드를 찾아 에러 발생
 *   static은 클래스 상수이므로 예외 (e.g., public static readonly TYPE = 'foo')
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
 * 파일당 800줄 제한 (warn).
 * 800줄을 넘으면 단일 책임 원칙(SRP) 위반 가능성이 높고, 리뷰/테스트 난이도가 급증.
 * 테스트 파일은 seed 데이터와 시나리오 나열로 길어지기 쉬워 제외.
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
 * import/no-cycle — 레이어 간·모듈 간 순환 의존성 감지.
 *
 * warn으로 시작: 기존 코드에서 cycle이 누적되어 있을 수 있어 error로 승격 전
 * 실제 프로젝트 운영 데이터를 본 뒤 전환 판단. forwardRef 정당 케이스(circular
 * module DI)는 일반적으로 type-only import로 회피되므로 대부분 자동 통과.
 *
 * 옵션:
 *   maxDepth: 10       — 성능/정확도 균형 (Infinity는 느림)
 *   ignoreExternal     — node_modules 체크 생략
 *   allowUnsafeDynamicCyclicDependency: false — 런타임 cycle은 여전히 잡음
 */
export const baseCycleRules = defineConfig({
  files: ["src/**/*.ts"],
  ignores: ["**/*.spec.ts", "**/*.test.ts"],
  plugins: { import: importPlugin },
  rules: {
    "import/no-cycle": ["warn", { maxDepth: 10, ignoreExternal: true }],
  },
});

// ─── Pre-built: Custom rules (conventions.md enforcement) ────────────────────
/**
 * conventions.md에서 표준 ESLint 룰로 표현이 불가능한 프로젝트 고유 규칙을
 * custom rule로 제공한다. 기존 opt-in 스택(custom-lint)을 base로 병합한 결과.
 *
 * 포함 룰:
 *   - local/require-api-property          : DTO 필드에 @ApiProperty 강제
 *   - local/dto-union-type-restriction    : T | undefined / class union 금지
 *   - local/dto-naming-convention         : bare *ResponseDto, *DataDto 금지
 *   - local/require-timestamptz           : ORM entity Date 컬럼에 timestamptz 강제
 *   - local/require-map-domain-exception  : controller catch에서 mapDomainException 호출 강제
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
 * ESLint가 아예 읽지 않을 경로.
 * - eslint.config.mjs  : 자체 설정 파일 (자기 참조 방지)
 * - eslint-rules/**    : jkit에서 주입한 룰 소스 (재-lint 불필요)
 * - dist/, coverage/   : 빌드·테스트 산출물
 * - .jkit/             : 툴체인 내부 작업 공간
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
 * 헥사고날 아키텍처 레이어별 import 제한 생성기.
 * 각 레이어 파일에 대해 금지 패턴을 적용한다. 스택별 framework/infra 패키지 목록을
 * 머지해 주입받는다.
 *
 * 레이어별 제한 요약:
 *   - model/      : 프레임워크 + 다른 레이어 전부 금지 (순수 TS)
 *   - service/    : @nestjs/common의 Injectable/Inject, @nestjs/event-emitter의
 *                   OnEvent만 허용. controller/provider 직접 import 금지
 *   - port/       : 프레임워크 + 다른 레이어 금지 (인터페이스는 순수해야 함)
 *   - exception/  : 프레임워크 금지 (도메인 예외는 HTTP 비의존)
 *   - dto/        : path alias만 강제 (class-validator 등 사용 허용)
 *   - controller/ : path alias만 강제 (NestJS 생태계 자유 사용)
 *   - provider/   : path alias만 강제 (ORM/SDK 자유 사용 — 구현 계층이므로)
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
 * 아키텍처 경계(boundaries) 룰 생성기.
 * 활성화되는 룰:
 *   - boundaries/no-unknown       : off — 외부 패키지 import는 자유 (NestJS 특성)
 *   - boundaries/no-unknown-files : warn — 매칭 안 되는 파일은 경고만 (*.module.ts 등)
 *   - boundaries/dependencies     : error — from → to 관계 allow-list 검사
 *     (default: 'disallow' — allow에 없으면 전부 거부)
 */
export function buildArchitectureBoundaries(
  elements,
  rules,
  ignores = baseBoundaryIgnores,
) {
  return defineConfig({
    plugins: { boundaries },
    settings: {
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

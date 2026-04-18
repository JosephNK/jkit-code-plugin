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
];

/**
 * 아키텍처 경계 선언 — 각 type이 어떤 경로에 해당하는지 정의.
 * eslint-plugin-boundaries가 이 맵을 사용하여 파일별 레이어를 판별한다.
 *
 * 레이어 개요 (Clean Architecture 스타일):
 *   - Domain:   순수 비즈니스 로직 (models/errors/ports/services) — 최하위 의존 대상
 *   - API:      외부 통신 어댑터 (client/endpoint/dto/mapper/repository/hook/helper)
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
  { type: 'api-helper', mode: 'full', pattern: ['src/lib/api/*.ts'] },           // src/lib/api 루트 유틸
  // Shared lib — src/lib 루트의 공용 유틸
  { type: 'lib-shared', mode: 'full', pattern: ['src/lib/*.ts'] },
  // UI layer
  { type: 'shared-ui', pattern: ['src/components'] },                            // 전역 재사용 컴포넌트
  { type: 'page-component', pattern: ['src/app/**/_components'] },               // 페이지 전용 컴포넌트
  { type: 'page-provider', pattern: ['src/app/**/_providers'] },                 // 페이지 전용 Provider
  // Common — 전역 공용 리소스
  { type: 'dictionary', mode: 'full', pattern: ['src/common/dictionaries/*', 'src/app/*/dictionaries.ts'] }, // i18n
  { type: 'shared-type', pattern: ['src/common/types'] },                        // 전역 타입
  // Page (catch-all) — 위 패턴에 매칭 안 된 src/app 전부
  { type: 'page', pattern: ['src/app'] },
];

/**
 * 레이어 간 의존성 방향 선언 (allow-list).
 * 기본 `disallow` 정책 위에 `allow`된 조합만 import를 허용한다.
 * 핵심 원칙:
 *   - 도메인은 외부 레이어를 모른다 (단방향: UI/API → Domain)
 *   - API 원시 계층(client/endpoint/dto)은 어떤 레이어도 import 하지 않는다
 *   - UI는 도메인 모델만 참조하고 도메인 서비스 호출은 hook을 통해서만
 *   - Page는 최상위 컨슈머 (UI + api-helper + dictionary 등 조합)
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
    // Repository: Port 구현체. 모든 원시 통신 요소 + domain 사용
    from: { type: 'api-repository' },
    allow: [
      { to: { type: 'api-client' } },
      { to: { type: 'api-endpoint' } },
      { to: { type: 'api-mapper' } },
      { to: { type: 'domain-port' } },
      { to: { type: 'domain-error' } },
      { to: { type: 'domain-model' } },
    ],
  },
  // Hook: UI에 제공되는 데이터 페칭 훅. UseCase(domain-service)만 호출 (Repository 직접 호출 금지)
  { from: { type: 'api-hook' }, allow: [{ to: { type: 'domain-service' } }] },
  {
    // api-helper: src/lib/api 루트 유틸. domain/repository 조합 가능 (조립 허브)
    from: { type: 'api-helper' },
    allow: [
      { to: { type: 'domain-model' } },
      { to: { type: 'domain-error' } },
      { to: { type: 'domain-port' } },
      { to: { type: 'domain-service' } },
      { to: { type: 'api-repository' } },
      { to: { type: 'api-helper' } },
    ],
  },
  // lib-shared: src/lib 루트 공용 유틸. 내부 의존 0개 (순수 유틸만)
  { from: { type: 'lib-shared' }, allow: [] },
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
    // Page (최상위 컨슈머): 페이지 조립에 필요한 거의 모든 레이어 사용 가능
    // (단, domain-service/repository/api-hook 직접 호출 금지 — 컴포넌트/헬퍼를 거쳐야 함)
    from: { type: 'page' },
    allow: [
      { to: { type: 'page-component' } },
      { to: { type: 'page-provider' } },
      { to: { type: 'shared-ui' } },
      { to: { type: 'dictionary' } },
      { to: { type: 'shared-type' } },
      { to: { type: 'api-helper' } },
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

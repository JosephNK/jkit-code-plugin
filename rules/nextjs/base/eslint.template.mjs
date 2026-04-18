// =============================================================================
// JKit Next.js ESLint Config Template
// -----------------------------------------------------------------------------
// 프로젝트 초기화(`/jkit:nextjs-init`) 시 `eslint.config.mjs`로 복사되는 템플릿.
// `{{PLACEHOLDER}}` 마커는 gen-eslint.sh가 선택된 스택(Mantine, TanStack Query 등)의
// rules.mjs에서 export된 값으로 치환한다.
//
// 플레이스홀더:
//   {{STACK_IMPORTS}}       — 스택별 export import 구문
//   {{RESTRICTED_PATTERNS}} — 전역 import 금지 패턴 추가분
//   {{DOMAIN_BANNED}}       — 도메인 레이어 추가 금지 패키지
//   {{RESTRICTED_SYNTAX}}   — 추가 AST selector 금지 규칙
//   {{BOUNDARY_ELEMENTS}}   — 추가 boundary element 정의
//   {{BOUNDARY_RULES}}      — 추가 boundary from/allow 규칙
//   {{BOUNDARY_PATCHES}}    — 기존 base 규칙에 allow를 덧붙이는 패치
//   {{BOUNDARY_IGNORES}}    — boundary 검사 제외 경로 추가분
// =============================================================================

import {
  baseBoundaryElements,
  baseBoundaryIgnores,
  baseBoundaryRules,
  baseConfig,
  baseDomainBannedPackages,
  baseIgnores,
  baseRestrictedPatterns,
  baseRestrictedSyntax,
  baseServerComponentRules,
  buildArchitectureBoundaries,
  buildDomainPurity,
  buildRestrictedImports,
} from '@jkit/eslint-rules/nextjs/base/eslint.base.mjs';
// {{STACK_IMPORTS}}

// ─── Helper: patch additional allow rules into base boundary rules ────────────
/**
 * base 규칙의 `allow` 배열에 스택별 추가 허용 항목을 덧붙인다.
 * 예: MongoDB 스택이 "api-repository → db" 허용을 추가하고 싶을 때
 *     기존 api-repository 룰을 그대로 두고 allow에만 `{ to: { type: 'db' } }`를 append.
 *
 * patches 예시:
 *   [{ from: 'api-repository', allow: { to: { type: 'db' } } }]
 */
function patchBoundaryRules(rules, patches) {
  return rules.map((rule) => {
    const matching = patches.filter((p) => p.from === rule.from?.type);
    if (matching.length === 0) return rule;
    return {
      ...rule,
      allow: [...(rule.allow || []), ...matching.map((p) => p.allow)],
    };
  });
}

// ─── Merged restricted patterns (base + stacks) ──────────────────────────────
// 전역 + 도메인 순수성 양쪽에서 공통으로 사용되는 import 금지 패턴 목록
const allRestrictedPatterns = [
  ...baseRestrictedPatterns,
// {{RESTRICTED_PATTERNS}}
];

// ─── Final config assembly ────────────────────────────────────────────────────
// 블록 순서 중요: 뒤에 오는 config가 앞의 룰을 override한다.
const eslintConfig = [
  // [1] 베이스 (Next.js + TS + Prettier + SonarJS + 공통 스타일)
  ...baseConfig,

  // [2] tsconfigRootDir를 프로젝트 루트로 재지정
  //     (base에서는 이 템플릿의 dirname을 가리키므로, 소비 프로젝트 루트로 override)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // [3] 전역 import 제한 (base + 스택)
  ...buildRestrictedImports(allRestrictedPatterns),

  // [4] 도메인 순수성 — src/lib/domain/**에만 적용. 프레임워크/브라우저 글로벌 차단
  ...buildDomainPurity(
    [
      ...baseDomainBannedPackages,
// {{DOMAIN_BANNED}}
    ],
    allRestrictedPatterns,
  ),

  // [5] AST selector 기반 금지 구문 — Server Component 룰보다 먼저 와야 한다
  //     (같은 룰을 뒤의 block에서 error로 override하기 위해 여기는 warn)
  {
    rules: {
      'no-restricted-syntax': [
        'warn',
        ...baseRestrictedSyntax,
// {{RESTRICTED_SYNTAX}}
      ],
    },
  },

  // [6] Server Component 전용 — src/app/** 에서 Hook 호출 금지 (error, 위 warn을 override)
  ...baseServerComponentRules,

  // [7] 아키텍처 경계 — elements + dependencies 규칙 + 제외 경로
  ...buildArchitectureBoundaries(
    [
      ...baseBoundaryElements,
// {{BOUNDARY_ELEMENTS}}
    ],
    patchBoundaryRules(
      [
        ...baseBoundaryRules,
// {{BOUNDARY_RULES}}
      ],
      [
// {{BOUNDARY_PATCHES}}
      ],
    ),
    [
      ...baseBoundaryIgnores,
// {{BOUNDARY_IGNORES}}
    ],
  ),

  // ─── Project-specific rules below ───
  // 프로젝트 개별 override는 이 아래에 추가한다.

  // [8] 전역 ignore (빌드 산출물 등) — 맨 마지막에 위치
  baseIgnores,
];

export default eslintConfig;

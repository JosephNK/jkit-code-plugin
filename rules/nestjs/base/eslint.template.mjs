// =============================================================================
// JKit NestJS ESLint Config Template
// -----------------------------------------------------------------------------
// 프로젝트 초기화(`/jkit:nestjs-init`) 시 `eslint.config.mjs`로 복사되는 템플릿.
// `{{PLACEHOLDER}}` 마커는 gen-eslint.sh가 선택된 스택(TypeORM, GCP, Anthropic 등)
// 의 rules.mjs에서 export된 값으로 치환한다.
//
// 플레이스홀더:
//   {{STACK_IMPORTS}}        — 스택별 export import 구문
//   {{FRAMEWORK_PACKAGES}}   — 순수 레이어(model/port/exception)에서 금지할 패키지
//   {{INFRA_PACKAGES}}       — service/에서 직접 import 금지할 인프라 SDK
//   {{BOUNDARY_ELEMENTS}}    — 추가 boundary element 정의
//   {{BOUNDARY_RULES}}       — 추가 boundary from/allow 규칙
//   {{BOUNDARY_IGNORES}}     — boundary 검사 제외 경로 추가분
//   {{CUSTOM_CONFIG}}        — 커스텀 룰(custom-lint 플러그인) 주입 지점
// =============================================================================

import {
  baseBoundaryElements,
  baseBoundaryIgnores,
  baseBoundaryRules,
  baseConfig,
  baseCustomRules,
  baseCycleRules,
  baseFileSizeRules,
  baseFrameworkPackages,
  baseIgnores,
  baseImmutabilityRules,
  basePathAliasPattern,
  buildArchitectureBoundaries,
  buildLayerRestrictions,
} from '@jkit/eslint-rules/nestjs/base/eslint.base.mjs';
// {{STACK_IMPORTS}}

// ─── Merged framework packages (base + stacks) ────────────────────────────────
// 모든 순수 레이어(model/, port/, exception/)에서 import 차단할 패키지 총합
const allFrameworkPackages = [
  ...baseFrameworkPackages,
// {{FRAMEWORK_PACKAGES}}
];

// ─── Merged infra SDK packages (stacks only — banned from service/exception) ──
// service/ 계층에서 직접 import 금지되는 인프라 SDK 목록 (Port로 추상화 강제)
const allInfraPackages = [
// {{INFRA_PACKAGES}}
];

// ─── Final config assembly ────────────────────────────────────────────────────
// 블록 순서 중요: 뒤에 오는 config가 앞의 룰을 override한다.
const eslintConfig = [
  // [1] 베이스 (ESLint + TS + Prettier + 공통 스타일 + 테스트 완화)
  ...baseConfig,

  // [2] tsconfigRootDir를 프로젝트 루트로 재지정
  //     (base에서는 이 템플릿의 dirname을 가리키므로 소비 프로젝트 루트로 override)
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // [3] 헥사고날 레이어별 import 제한 (model/service/port/exception/dto/controller/provider)
  ...buildLayerRestrictions(allFrameworkPackages, allInfraPackages, basePathAliasPattern),

  // [4] 불변성 — Entity와 DTO 필드에 readonly 강제
  ...baseImmutabilityRules,

  // [5] 아키텍처 경계 — elements + dependencies 규칙 + 제외 경로
  ...buildArchitectureBoundaries(
    [
      ...baseBoundaryElements,
// {{BOUNDARY_ELEMENTS}}
    ],
    [
      ...baseBoundaryRules,
// {{BOUNDARY_RULES}}
    ],
    [
      ...baseBoundaryIgnores,
// {{BOUNDARY_IGNORES}}
    ],
  ),

  // [6] 파일 크기 제한 (800 라인)
  ...baseFileSizeRules,

  // [7] 프로젝트 공용 custom 룰 (conventions.md 강제)
  //     @ApiProperty 필수, DTO 네이밍/유니온 제약, mapDomainException, timestamptz 등
  ...baseCustomRules,

  // [7-1] 순환 의존성 감지 (warn — 실제 프로젝트 검증 후 error 승격 권장)
  ...baseCycleRules,

// {{CUSTOM_CONFIG}}

  // ─── Project-specific rules below ───
  // 프로젝트 개별 override는 이 아래에 추가한다.

  // [8] 전역 ignore (빌드 산출물 등) — 맨 마지막에 위치
  baseIgnores,
];

export default eslintConfig;

// =============================================================================
// JKit Next.js ESLint Base Rules — Barrel
// -----------------------------------------------------------------------------
// 각 export는 ./eslint-rules/ 하위 단일 관심사 파일로 분리되어 있다.
// 이 파일은 외부 소비자(eslint.template.mjs, gen-eslint.mjs, stack rules)에
// 단일 진입점을 제공하기 위한 re-export 전용 barrel이다.
//
// 분류:
//   - Raw data (스택에서 확장/머지 가능한 원본 데이터)
//   - Pre-built configs (즉시 spread 가능한 defineConfig 블록)
//   - Builders (스택별 데이터를 받아 config를 생성하는 팩토리)
//
// 룰을 추가/수정하려면 해당 sub-파일을 직접 편집하고
// `node scripts/typescript/gen-eslint-reference.mjs` 로 md를 재생성한다.
// =============================================================================

// ─── Raw data ────────────────────────────────────────────────────────────────
export { baseRestrictedPatterns } from './eslint-rules/restricted-patterns.mjs';
export { baseImportResolverSettings } from './eslint-rules/import-resolver-settings.mjs';
export { baseDomainBannedPackages } from './eslint-rules/domain-banned-packages.mjs';
export { baseBoundaryElements } from './eslint-rules/boundary-elements.mjs';
export { baseStructureAnnotations } from './eslint-rules/structure-annotations.mjs';
export { baseLayerSemantics } from './eslint-rules/layer-semantics.mjs';
export { baseBoundaryRules } from './eslint-rules/boundary-rules.mjs';
export { baseBoundaryIgnores } from './eslint-rules/boundary-ignores.mjs';
export { baseRestrictedSyntax } from './eslint-rules/restricted-syntax.mjs';

// ─── Pre-built configs ───────────────────────────────────────────────────────
export { baseConfig } from './eslint-rules/base-config.mjs';
export { baseServerComponentRules } from './eslint-rules/server-component.mjs';
export { baseCustomRules } from './eslint-rules/custom-rules.mjs';
export { baseIgnores } from './eslint-rules/ignores.mjs';

// ─── Builders ────────────────────────────────────────────────────────────────
export { buildRestrictedImports } from './eslint-rules/build-restricted-imports.mjs';
export { buildDomainPurity } from './eslint-rules/build-domain-purity.mjs';
export { buildArchitectureBoundaries } from './eslint-rules/build-architecture-boundaries.mjs';

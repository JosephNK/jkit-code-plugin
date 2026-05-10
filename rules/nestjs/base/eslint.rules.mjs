// =============================================================================
// JKit NestJS ESLint Base Rules — Barrel
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
export { basePathAliasPattern } from "./eslint-rules/path-alias-pattern.mjs";
export { baseImportResolverSettings } from "./eslint-rules/import-resolver-settings.mjs";
export { baseFrameworkPackages } from "./eslint-rules/framework-packages.mjs";
export { baseBoundaryElements } from "./eslint-rules/boundary-elements.mjs";
export { baseStructureAnnotations } from "./eslint-rules/structure-annotations.mjs";
export { baseLayerSemantics } from "./eslint-rules/layer-semantics.mjs";
export { baseBoundaryRules } from "./eslint-rules/boundary-rules.mjs";
export { baseBoundaryIgnores } from "./eslint-rules/boundary-ignores.mjs";

// ─── Pre-built configs ───────────────────────────────────────────────────────
export { baseConfig } from "./eslint-rules/base-config.mjs";
export { baseImmutabilityRules } from "./eslint-rules/immutability.mjs";
export { baseFileSizeRules } from "./eslint-rules/file-size.mjs";
export { baseCycleRules } from "./eslint-rules/cycle.mjs";
export { baseCustomRules } from "./eslint-rules/custom-rules.mjs";
export { baseIgnores } from "./eslint-rules/ignores.mjs";

// ─── Builders ────────────────────────────────────────────────────────────────
export { buildLayerRestrictions } from "./eslint-rules/build-layer-restrictions.mjs";
export { buildArchitectureBoundaries } from "./eslint-rules/build-architecture-boundaries.mjs";

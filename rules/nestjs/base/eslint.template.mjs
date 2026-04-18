import {
  baseBoundaryElements,
  baseBoundaryIgnores,
  baseBoundaryRules,
  baseConfig,
  baseFileSizeRules,
  baseFrameworkPackages,
  baseIgnores,
  baseImmutabilityRules,
  basePathAliasPattern,
  buildArchitectureBoundaries,
  buildLayerRestrictions,
} from '@jkit/eslint-rules/nestjs/base/eslint.base.mjs';
// {{STACK_IMPORTS}}

// ─── Merged framework packages (base + stacks) ───
const allFrameworkPackages = [
  ...baseFrameworkPackages,
// {{FRAMEWORK_PACKAGES}}
];

// ─── Merged infra SDK packages (stacks only — banned from service/exception) ───
const allInfraPackages = [
// {{INFRA_PACKAGES}}
];

const eslintConfig = [
  ...baseConfig,

  // Override tsconfigRootDir to project root
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Hexagonal architecture: per-layer import restrictions
  ...buildLayerRestrictions(allFrameworkPackages, allInfraPackages, basePathAliasPattern),

  // Immutability: readonly on Entity and DTO fields
  ...baseImmutabilityRules,

  // Architecture boundaries (base + stacks)
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

  // File size limit (800 lines)
  ...baseFileSizeRules,

// {{CUSTOM_CONFIG}}

  // ─── Project-specific rules below ───

  baseIgnores,
];

export default eslintConfig;

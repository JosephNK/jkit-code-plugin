import {
  baseConfig,
  baseBoundaryElements,
  baseBoundaryIgnores,
  baseBoundaryRules,
  baseDomainBannedPackages,
  baseIgnores,
  baseRestrictedPatterns,
  baseRestrictedSyntax,
  baseServerComponentRules,
  buildArchitectureBoundaries,
  buildDomainPurity,
  buildRestrictedImports,
} from './.jkit/rules/base/eslint.base.mjs';
// {{STACK_IMPORTS}}

// ─── Helper: patch additional allow rules into base boundary rules ───
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

// ─── Merged restricted patterns (base + stacks) ───
const allRestrictedPatterns = [
  ...baseRestrictedPatterns,
// {{RESTRICTED_PATTERNS}}
];

const eslintConfig = [
  ...baseConfig,

  // Override tsconfigRootDir to project root
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Global restricted imports (base + stacks)
  ...buildRestrictedImports(allRestrictedPatterns),

  // Domain purity (base + stacks banned packages, with merged restricted patterns)
  ...buildDomainPurity(
    [
      ...baseDomainBannedPackages,
// {{DOMAIN_BANNED}}
    ],
    allRestrictedPatterns,
  ),

  // Restricted syntax (base + stacks) — MUST come before serverComponentRules
  {
    rules: {
      'no-restricted-syntax': [
        'warn',
        ...baseRestrictedSyntax,
// {{RESTRICTED_SYNTAX}}
      ],
    },
  },

  // Server component rules — overwrites no-restricted-syntax for SC files (error > warn)
  ...baseServerComponentRules,

  // Architecture boundaries (base + stacks)
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

  ...baseIgnores,
];

export default eslintConfig;

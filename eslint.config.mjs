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
} from './.jkit/base/eslint.base.mjs';
import {
  mantineDomainBannedPackages,
  mantineRestrictedPatterns,
  mantineRestrictedSyntax,
} from './.jkit/mantine/eslint.rules.mjs';
import {
  mongodbBoundaryAllowPatches,
  mongodbBoundaryElements,
  mongodbBoundaryRules,
  mongodbDomainBannedPackages,
} from './.jkit/mongodb/eslint.rules.mjs';
import {
  nextauthBoundaryAllowPatches,
  nextauthBoundaryElements,
  nextauthBoundaryRules,
  nextauthDomainBannedPackages,
} from './.jkit/nextauth/eslint.rules.mjs';
import {
  emailTemplateBoundaryAllowPatches,
  emailTemplateBoundaryElements,
  emailTemplateBoundaryRules,
} from './.jkit/email-template/eslint.rules.mjs';
import {
  tanstackQueryDomainBannedPackages,
} from './.jkit/tanstack-query/eslint.rules.mjs';

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
    ...mantineRestrictedPatterns,
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
    ...mantineDomainBannedPackages,
    ...mongodbDomainBannedPackages,
    ...nextauthDomainBannedPackages,
    ...tanstackQueryDomainBannedPackages,
    ],
    allRestrictedPatterns,
  ),

  // Restricted syntax (base + stacks) — MUST come before serverComponentRules
  {
    rules: {
      'no-restricted-syntax': [
        'warn',
        ...baseRestrictedSyntax,
        ...mantineRestrictedSyntax,
      ],
    },
  },

  // Server component rules — overwrites no-restricted-syntax for SC files (error > warn)
  ...baseServerComponentRules,

  // Architecture boundaries (base + stacks)
  ...buildArchitectureBoundaries(
    [
      ...baseBoundaryElements,
      ...mongodbBoundaryElements,
      ...nextauthBoundaryElements,
      ...emailTemplateBoundaryElements,
    ],
    patchBoundaryRules(
      [
        ...baseBoundaryRules,
        ...mongodbBoundaryRules,
        ...nextauthBoundaryRules,
        ...emailTemplateBoundaryRules,
      ],
      [
        ...mongodbBoundaryAllowPatches,
        ...nextauthBoundaryAllowPatches,
        ...emailTemplateBoundaryAllowPatches,
      ],
    ),
    [
      ...baseBoundaryIgnores,
      'src/proxy.ts',
      'src/theme.ts',
    ],
  ),

  // ─── Project-specific rules below ───

  ...baseIgnores,
];

export default eslintConfig;


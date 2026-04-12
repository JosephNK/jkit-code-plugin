import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

// ─── Raw data (for project-level merging) ───

export const baseRestrictedPatterns = [
  {
    group: ['../../**'],
    message: 'Use @/* path alias instead of deep relative parent imports.',
  },
];

export const baseDomainBannedPackages = [
  'react',
  'react/**',
  'react-dom',
  'react-dom/**',
  'next',
  'next/**',
];

export const baseBoundaryElements = [
  // Domain layer
  { type: 'domain-model', pattern: ['src/lib/domain/models'] },
  { type: 'domain-error', pattern: ['src/lib/domain/errors'] },
  { type: 'domain-port', pattern: ['src/lib/domain/ports'] },
  { type: 'domain-service', pattern: ['src/lib/domain/services'] },
  // API adapter layer
  { type: 'api-client', mode: 'full', pattern: ['src/lib/api/client.ts'] },
  { type: 'api-endpoint', mode: 'full', pattern: ['src/lib/api/endpoints.ts'] },
  { type: 'api-dto', mode: 'full', pattern: ['src/lib/api/types.ts'] },
  { type: 'api-mapper', pattern: ['src/lib/api/mappers'] },
  { type: 'api-repository', pattern: ['src/lib/api/repositories'] },
  { type: 'api-hook', pattern: ['src/lib/api/hooks'] },
  { type: 'api-helper', mode: 'full', pattern: ['src/lib/api/*.ts'] },
  // Shared lib
  { type: 'lib-shared', mode: 'full', pattern: ['src/lib/*.ts'] },
  // UI layer
  { type: 'shared-ui', pattern: ['src/components'] },
  { type: 'page-component', pattern: ['src/app/**/_components'] },
  { type: 'page-provider', pattern: ['src/app/**/_providers'] },
  // Common
  { type: 'dictionary', mode: 'full', pattern: ['src/common/dictionaries/*', 'src/app/*/dictionaries.ts'] },
  { type: 'shared-type', pattern: ['src/common/types'] },
  // Page (catch-all)
  { type: 'page', pattern: ['src/app'] },
];

export const baseBoundaryRules = [
  { from: { type: 'domain-model' }, allow: [{ to: { type: 'domain-model' } }] },
  { from: { type: 'domain-error' }, allow: [{ to: { type: 'domain-error' } }] },
  { from: { type: 'domain-port' }, allow: [{ to: { type: 'domain-model' } }] },
  {
    from: { type: 'domain-service' },
    allow: [
      { to: { type: 'domain-model' } },
      { to: { type: 'domain-port' } },
      { to: { type: 'domain-error' } },
      { to: { type: 'domain-service' } },
    ],
  },
  { from: { type: 'api-client' }, allow: [] },
  { from: { type: 'api-endpoint' }, allow: [] },
  { from: { type: 'api-dto' }, allow: [] },
  {
    from: { type: 'api-mapper' },
    allow: [{ to: { type: 'domain-model' } }, { to: { type: 'api-dto' } }],
  },
  {
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
  { from: { type: 'api-hook' }, allow: [{ to: { type: 'domain-service' } }] },
  {
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
  { from: { type: 'lib-shared' }, allow: [] },
  {
    from: { type: 'shared-ui' },
    allow: [
      { to: { type: 'domain-model' } },
      { to: { type: 'shared-ui' } },
      { to: { type: 'shared-type' } },
    ],
  },
  {
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
    from: { type: 'page-provider' },
    allow: [{ to: { type: 'lib-shared' } }],
  },
  {
    from: { type: 'dictionary' },
    allow: [{ to: { type: 'shared-type' } }, { to: { type: 'dictionary' } }],
  },
  { from: { type: 'shared-type' }, allow: [{ to: { type: 'dictionary' } }] },
  {
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
];

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
export const baseConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Type-checked linting
  ...tseslint.configs.recommendedTypeCheckedOnly.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-deprecated': 'error',
    },
  },

  prettier,

  sonarjs.configs.recommended,
  {
    rules: {
      'sonarjs/todo-tag': 'off',
      'sonarjs/no-nested-conditional': 'warn',
    },
  },

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },

  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/function-component-definition': [
        'error',
        {
          namedComponents: ['function-declaration', 'arrow-function'],
          unnamedComponents: 'arrow-function',
        },
      ],
    },
  },
]);

// ─── Pre-built: Server Component rules ───
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

// ─── Pre-built: Global ignores ───
export const baseIgnores = globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts', '.jkit/**']);

// ─── Builder: Global restricted imports (merge base + stack patterns) ───
export function buildRestrictedImports(patterns) {
  return defineConfig([
    {
      rules: {
        'no-restricted-imports': ['error', { patterns }],
      },
    },
  ]);
}

// ─── Builder: Domain purity (merge base + stack banned packages) ───
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

// ─── Builder: Architecture boundaries (merge base + stack elements/rules) ───
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

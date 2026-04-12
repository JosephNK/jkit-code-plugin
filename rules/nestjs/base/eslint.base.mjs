import { defineConfig, globalIgnores } from 'eslint/config';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ─── Raw data (for project-level merging) ───

export const basePathAliasPattern = {
  group: ['../**'],
  message: 'Use @/* path alias instead of relative parent imports.',
};

export const baseFrameworkPackages = [
  '@nestjs/*',
  'class-validator',
  'class-transformer',
  'express',
  'express/*',
];

export const baseBoundaryElements = [
  { type: 'model', pattern: ['src/modules/**/model/**'] },
  { type: 'port', pattern: ['src/modules/**/port/**'] },
  { type: 'service', pattern: ['src/modules/**/service/**'] },
  { type: 'controller', pattern: ['src/modules/**/controller/**'] },
  { type: 'provider', pattern: ['src/modules/**/provider/**'] },
  { type: 'exception', pattern: ['src/modules/**/exception/**'] },
  { type: 'dto', pattern: ['src/modules/**/dto/**'] },
  { type: 'common', pattern: ['src/common/**'] },
  { type: 'infrastructure', pattern: ['src/infrastructure/**'] },
  { type: 'libs', pattern: ['src/libs/**'] },
];

export const baseBoundaryRules = [
  // model — only model (pure TS, no external deps)
  {
    from: { type: 'model' },
    allow: { to: { type: 'model' } },
  },
  // exception — base exceptions from common
  {
    from: { type: 'exception' },
    allow: { to: { type: ['exception', 'common'] } },
  },
  // port — model + common only
  {
    from: { type: 'port' },
    allow: { to: { type: ['model', 'common'] } },
  },
  // service — model, port, exception, common, infrastructure
  {
    from: { type: 'service' },
    allow: {
      to: {
        type: [
          'model',
          'port',
          'exception',
          'common',
          'infrastructure',
        ],
      },
    },
  },
  // controller — port, dto, model (types), exception, common, libs
  {
    from: { type: 'controller' },
    allow: {
      to: {
        type: [
          'port',
          'dto',
          'model',
          'exception',
          'common',
          'libs',
        ],
      },
    },
  },
  // provider — port, model, common, infrastructure, provider (orm-entity cross-refs)
  {
    from: { type: 'provider' },
    allow: {
      to: {
        type: [
          'port',
          'model',
          'common',
          'infrastructure',
          'provider',
        ],
      },
    },
  },
  // dto — model, common, dto (internal refs like PartialType)
  {
    from: { type: 'dto' },
    allow: { to: { type: ['model', 'common', 'dto'] } },
  },
  // module (*.module.ts) — DI assembly, excluded via boundaries/ignore
  // common — internal only
  {
    from: { type: 'common' },
    allow: { to: { type: 'common' } },
  },
  // infrastructure — internal + common
  {
    from: { type: 'infrastructure' },
    allow: { to: { type: ['infrastructure', 'common'] } },
  },
  // libs — can access anything (independent library modules)
  {
    from: { type: 'libs' },
    allow: {
      to: {
        type: [
          'model',
          'port',
          'service',
          'controller',
          'provider',
          'exception',
          'dto',
          'common',
          'infrastructure',
          'libs',
        ],
      },
    },
  },
];

export const baseBoundaryIgnores = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.module.ts',
  'src/main.ts',
  'src/app.*.ts',
  'src/test/**',
  'src/modules/health/**',
  'src/modules/**/common/**',
  'test/**',
  '.jkit/**',
];

// ─── Pre-built config (ESLint + TypeScript + Prettier + Import sorting) ───
export const baseConfig = defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Import sorting & unused imports
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
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Base rules
  {
    rules: {
      'prefer-const': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-warning-comments': ['warn', { terms: ['TODO', 'FIXME', 'HACK'] }],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // Test file relaxations
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);

// ─── Pre-built: Immutability rules (readonly on Entity and DTO fields) ───
export const baseImmutabilityRules = defineConfig({
  files: [
    'src/modules/**/model/**/*.entity.ts',
    'src/modules/**/dto/**/*.dto.ts',
  ],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'PropertyDefinition:not([readonly=true]):not([static=true])',
        message:
          'Entity and DTO fields must use readonly. (conventions.md: Immutability)',
      },
    ],
  },
});

// ─── Pre-built: File size limit ───
export const baseFileSizeRules = defineConfig({
  files: ['src/**/*.ts'],
  ignores: ['**/*.spec.ts'],
  rules: {
    'max-lines': [
      'warn',
      { max: 800, skipBlankLines: true, skipComments: true },
    ],
  },
});

// ─── Pre-built: Global ignores ───
export const baseIgnores = globalIgnores(['eslint.config.mjs', 'eslint-rules/**', 'dist/**', 'coverage/**', '.jkit/**']);

// ─── Builder: Hexagonal layer import restrictions ───
export function buildLayerRestrictions(frameworkPackages, infraPackages = [], pathAliasPattern = basePathAliasPattern) {
  return defineConfig(
    // model/ — no frameworks, no other layers, @/ alias enforced
    {
      files: ['src/modules/**/model/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              pathAliasPattern,
              {
                group: frameworkPackages,
                message:
                  'model/ must not import frameworks or external libraries.',
              },
              {
                group: [
                  '**/service/**',
                  '**/controller/**',
                  '**/provider/**',
                  '**/dto/**',
                ],
                message:
                  'model/ must not import from other layers (service, controller, provider, dto).',
              },
            ],
          },
        ],
      },
    },

    // service/ — only Injectable/Inject + OnEvent, @/ alias enforced
    {
      files: ['src/modules/**/service/**/*.ts'],
      ignores: ['**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@nestjs/common',
                allowImportNames: ['Injectable', 'Inject'],
                message:
                  'service/ may only import Injectable and Inject from @nestjs/common.',
              },
              {
                name: '@nestjs/event-emitter',
                allowImportNames: ['OnEvent'],
                message:
                  'service/ may only import OnEvent from @nestjs/event-emitter.',
              },
            ],
            patterns: [
              pathAliasPattern,
              {
                group: [
                  '@nestjs/*',
                  '!@nestjs/common',
                  '!@nestjs/event-emitter',
                ],
                message:
                  'service/ must not import from @nestjs/* (except @nestjs/common and @nestjs/event-emitter).',
              },
              ...(infraPackages.length > 0
                ? [{
                    group: infraPackages,
                    message:
                      'service/ must not import infrastructure SDKs directly.',
                  }]
                : []),
              {
                group: ['**/controller/**', '**/provider/**'],
                message:
                  'service/ must not import from controller/ or provider/.',
              },
            ],
          },
        ],
      },
    },

    // port/ — no frameworks, no Express, @/ alias enforced
    {
      files: ['src/modules/**/port/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              pathAliasPattern,
              {
                group: frameworkPackages,
                message:
                  'port/ must not import frameworks — use domain types instead.',
              },
              {
                group: [
                  '**/service/**',
                  '**/controller/**',
                  '**/provider/**',
                  '**/dto/**',
                ],
                message:
                  'port/ must not import from service/, controller/, provider/, or dto/.',
              },
            ],
          },
        ],
      },
    },

    // exception/ — no frameworks, @/ alias enforced
    {
      files: ['src/modules/**/exception/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              pathAliasPattern,
              {
                group: ['@nestjs/*', ...infraPackages],
                message: 'exception/ must not import frameworks.',
              },
            ],
          },
        ],
      },
    },

    // dto/ — @/ alias enforced
    {
      files: ['src/modules/**/dto/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [pathAliasPattern],
          },
        ],
      },
    },

    // controller/ — @/ alias enforced
    {
      files: ['src/modules/**/controller/**/*.ts'],
      ignores: ['**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [pathAliasPattern],
          },
        ],
      },
    },

    // provider/ — @/ alias enforced
    {
      files: ['src/modules/**/provider/**/*.ts'],
      ignores: ['**/*.spec.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [pathAliasPattern],
          },
        ],
      },
    },
  );
}

// ─── Builder: Architecture boundaries ───
export function buildArchitectureBoundaries(elements, rules, ignores = baseBoundaryIgnores) {
  return defineConfig({
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/ignore': ignores,
    },
    rules: {
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'warn',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules,
        },
      ],
    },
  });
}

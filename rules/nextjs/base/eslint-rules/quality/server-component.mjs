import { defineConfig } from 'eslint/config';

/**
 * Server Component(`src/app/**`)에서 React Hook 호출 금지 — 런타임 에러 차단.
 * `_components/`·`_providers/`는 'use client' 가정으로 제외.
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

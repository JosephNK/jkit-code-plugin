import { defineConfig } from 'eslint/config';

/**
 * 전역 `no-restricted-imports` 규칙 생성기.
 * 스택별 패턴을 머지한 최종 목록을 받아 ESLint config로 감싼다.
 */
export function buildRestrictedImports(restrictedPatterns) {
  return defineConfig([
    {
      rules: {
        'no-restricted-imports': ['error', { patterns: restrictedPatterns }],
      },
    },
  ]);
}

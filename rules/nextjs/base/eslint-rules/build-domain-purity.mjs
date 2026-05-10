import { defineConfig } from 'eslint/config';

import { baseRestrictedPatterns } from './restricted-patterns.mjs';

/**
 * 도메인 순수성 룰 생성기 (`src/lib/domain/**`).
 * 프레임워크 import + 브라우저 글로벌(fetch/window/document/storage) 차단.
 * 데이터는 domain-port를 통해 repository에서 주입.
 */
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

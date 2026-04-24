// =============================================================================
// JKit Next.js Stylelint Config Template
// -----------------------------------------------------------------------------
// 프로젝트 초기화(`/jkit:nextjs-init`) 시 `stylelint.config.mjs`로 복사되는 템플릿.
// 현재는 단일 베이스 config만 로드한다. 스택 확장이 필요해지면 gen-eslint.mjs와
// 같은 manifest 기반 템플릿 구조로 확장할 것.
// =============================================================================

import { stylelintBaseConfig } from '@jkit/code-plugin/nextjs/base/stylelint.rules.mjs';

/** @type {import('stylelint').Config} */
const config = {
  ...stylelintBaseConfig,
  rules: {
    ...stylelintBaseConfig.rules,
    // ─── Project-specific overrides below ───
    // 예: stylelint-config-standard 일부 룰을 완화하고 싶을 때
    // 'selector-class-pattern': null,
    // 'no-descending-specificity': null,
  },
  ignoreFiles: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/public/**',
  ],
};

export default config;

// =============================================================================
// JKit Next.js Stylelint Config Template
// -----------------------------------------------------------------------------
// 프로젝트 초기화(`/jkit:nextjs-init`) 시 `stylelint.config.mjs`로 복사되는 템플릿.
// 현재는 단일 베이스 config만 로드한다. 스택 확장이 필요해지면 gen-eslint.mjs와
// 같은 manifest 기반 템플릿 구조로 확장할 것.
// =============================================================================

import { stylelintBaseConfig } from "@jkit/code-plugin/nextjs/base/stylelint.rules.mjs";

/** @type {import('stylelint').Config} */
const config = {
  ...stylelintBaseConfig,
  rules: {
    ...stylelintBaseConfig.rules,
    // ─── Project-specific overrides below ───
    // Tailwind CSS v4 at-rules 화이트리스트 — `@theme`, `@apply`, `@layer` 등
    // stylelint-config-standard의 `at-rule-no-unknown: true`가 Tailwind directive를
    // 차단하므로 보강. Tailwind를 쓰지 않으면 이 블록은 제거해도 무방.
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "tailwind",
          "apply",
          "layer",
          "variants",
          "screen",
          "config",
          "plugin",
          "source",
          "utility",
          "custom-variant",
          "reference",
        ],
      },
    ],
    // Tailwind v4는 `@import "tailwindcss"` 문자열 형식 사용 — stylelint-config-standard의
    // `import-notation: "url"` 강제와 충돌하므로 해제.
    "import-notation": "string",
    // 추가 프로젝트별 override 예시:
    // 'selector-class-pattern': null,
    // 'no-descending-specificity': null,
  },
  ignoreFiles: [
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/public/**",
  ],
};

export default config;

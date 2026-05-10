import { defineConfig } from "eslint/config";

/**
 * 파일당 800줄 제한 (warn) — SRP 위반 신호.
 * 테스트 파일은 seed/시나리오 나열로 길어지기 쉬워 제외.
 */
export const baseFileSizeRules = defineConfig({
  files: ["src/**/*.ts"],
  ignores: ["**/*.spec.ts"],
  rules: {
    "max-lines": [
      "warn",
      { max: 800, skipBlankLines: true, skipComments: true },
    ],
  },
});

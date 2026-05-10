import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";

import { baseImportResolverSettings } from "./import-resolver-settings.mjs";

/**
 * import/no-cycle — 순환 의존성 감지 (warn).
 * 옵션: maxDepth 10 (성능 균형), ignoreExternal (node_modules 제외).
 */
export const baseCycleRules = defineConfig({
  files: ["src/**/*.ts"],
  ignores: ["**/*.spec.ts", "**/*.test.ts"],
  plugins: { import: importPlugin },
  settings: {
    ...baseImportResolverSettings,
  },
  rules: {
    "import/no-cycle": ["warn", { maxDepth: 10, ignoreExternal: true }],
  },
});

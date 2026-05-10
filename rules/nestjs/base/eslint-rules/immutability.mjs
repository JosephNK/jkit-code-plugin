import { defineConfig } from "eslint/config";

/**
 * Entity·DTO 인스턴스 필드에 readonly 강제 (instance field만; static은 예외).
 * 객체 불변성으로 예측 가능한 데이터 흐름 보장 (conventions.md: Immutability).
 */
export const baseImmutabilityRules = defineConfig({
  files: [
    "src/modules/**/model/**/*.entity.ts",
    "src/modules/**/dto/**/*.dto.ts",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "PropertyDefinition:not([readonly=true]):not([static=true])",
        message:
          "Entity and DTO fields must use readonly. (conventions.md: Immutability)",
      },
    ],
  },
});

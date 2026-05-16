import { globalIgnores } from "eslint/config";

/**
 * ESLint가 아예 읽지 않을 경로 (자체 설정, jkit 주입 룰, 빌드 산출물).
 * TypeORM 마이그레이션 파일은 generated 성격이라 boundary/룰 검사에서 제외한다.
 */
export const baseIgnores = globalIgnores([
  "eslint.config.mjs",
  "eslint-rules/**",
  "dist/**",
  "coverage/**",
  ".jkit/**",
  "migrations/**",
]);

/**
 * Boundary 검사 제외 — 테스트, DI 조립(*.module.ts), 부트스트랩(main/app),
 * 헬스체크, 모듈 내부 common.
 */
export const baseBoundaryIgnores = [
  "**/*.spec.ts",
  "**/*.test.ts",
  "**/*.module.ts",
  "src/main.ts",
  "src/app.*.ts",
  "src/test/**",
  "src/modules/health/**",
  "src/modules/**/common/**",
  "test/**",
  ".jkit/**",
];

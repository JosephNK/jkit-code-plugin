import { globalIgnores } from "eslint/config";

/**
 * ESLint가 아예 읽지 않을 경로 (빌드 산출물, 자동 생성 타입, 툴체인 작업 공간).
 * `src/http/_generated/**`와 `specs/**`는 `/jkit:nextjs-openapi-gen`이 매 실행
 * 시 덮어쓰는 산출물이라 lint 대상에서 제외 (다른 파일이 import할 때 boundary
 * 패턴 매칭은 그대로 유효 — globalIgnores는 대상 파일 자체의 lint만 끈다).
 */
export const baseIgnores = globalIgnores([
  ".next/**",
  "out/**",
  "build/**",
  "coverage/**",
  "next-env.d.ts",
  ".jkit/**",
  "src/http/_generated/**",
  "specs/**",
]);

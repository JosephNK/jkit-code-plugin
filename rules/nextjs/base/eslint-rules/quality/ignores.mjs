import { globalIgnores } from 'eslint/config';

/**
 * ESLint가 아예 읽지 않을 경로 (빌드 산출물, 자동 생성 타입, 툴체인 작업 공간).
 */
export const baseIgnores = globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts', '.jkit/**']);

/**
 * Boundary 검사 제외 (boundaries/no-unknown-files 오탐 방지).
 * 테스트/스펙/설정, 루트 메타 파일, scripts/e2e 빌드 유틸, 전역 타입 등.
 */
export const baseBoundaryIgnores = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '*.config.*',
  '*.ts',
  '*.d.ts',
  'types/**',
  'src/common/types/**',
  '.jkit/**',
  'scripts/**',
  'e2e/**',
];

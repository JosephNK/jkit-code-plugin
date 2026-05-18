/**
 * 도메인 레이어(`src/domain/**`)에서 import 금지 패키지.
 * 프레임워크 비의존 유지. 스택별로 UI 라이브러리 추가 차단.
 */
export const baseDomainBannedPackages = [
  'react',
  'react/**',
  'react-dom',
  'react-dom/**',
  'next',
  'next/**',
  // DB 드라이버/ORM — 도메인 서비스가 직접 DB를 만지면 순수성·테스트 용이성이 깨진다.
  // DB 접근은 Port(인터페이스) → Repository 구현 경로로만 허용.
  // 추가 차단이 필요하면 프로젝트 eslint.config.mjs에서 buildDomainPurity() 호출 시 확장.
  'mongodb',
  'mongodb/**',
  'pg',
  'pg/**',
  'redis',
  'redis/**',
  'typeorm',
  'typeorm/**',
];

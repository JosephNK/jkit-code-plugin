// =============================================================================
// JKit Next.js — MongoDB 스택 규칙
// -----------------------------------------------------------------------------
// DB 드라이버를 UI/도메인에서 격리하기 위한 boundary/element/금지 패키지 묶음.
// =============================================================================

// ─── MongoDB: Domain banned packages ──────────────────────────────────────────
/**
 * 도메인 레이어에서 mongodb 드라이버 import 전면 차단.
 * 도메인 서비스가 직접 DB를 만지면 순수성·테스트 용이성이 깨진다.
 * DB 접근은 Port(인터페이스) → Repository 구현 경로로만 허용.
 */
export const mongodbDomainBannedPackages = ['mongodb', 'mongodb/**'];

// ─── MongoDB: Boundary elements ───────────────────────────────────────────────
/**
 * DB 드라이버 래퍼 디렉토리를 새로운 boundary element로 등록.
 * `src/lib/db` 는 MongoClient 초기화·커넥션 풀 관리 등 DB 인프라 전담.
 */
export const mongodbBoundaryElements = [
  { type: 'db', pattern: ['src/lib/db'] },
];

// ─── MongoDB: Boundary rules ──────────────────────────────────────────────────
/**
 * DB 레이어는 프로젝트 내 어떤 element도 import 하지 않는다 (순수 드라이버 래퍼).
 * mongodb 패키지는 외부 의존이므로 element 규칙 대상 아님 → allow: [] 로 충분.
 */
export const mongodbBoundaryRules = [
  { from: { type: 'db' }, allow: [] },
];

// ─── MongoDB: Additional allow rules (patch into base rules) ──────────────────
/**
 * 기존 base의 `api-repository` 허용 목록에 `db` 접근을 추가.
 * Repository는 도메인 Port를 구현하면서 DB 드라이버를 실제로 호출하는 계층이므로
 * `api-repository → db` import가 필요하다.
 */
export const mongodbBoundaryAllowPatches = [
  { from: 'api-repository', allow: { to: { type: 'db' } } },
];

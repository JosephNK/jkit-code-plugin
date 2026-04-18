// =============================================================================
// JKit Next.js — NextAuth 스택 규칙
// -----------------------------------------------------------------------------
// Next.js 인증(`next-auth`)을 src/auth.ts 단일 진입점으로 격리하기 위한 규칙.
// =============================================================================

// ─── NextAuth: Domain banned packages ─────────────────────────────────────────
/**
 * 도메인 레이어에서 next-auth import 금지.
 * 인증은 어댑터 레이어 관심사이며 도메인 로직은 auth 구현체에 의존하면 안 된다.
 * 사용자·세션 개념이 도메인에 필요하면 해당 모델을 도메인 내부에 별도 정의한다.
 */
export const nextauthDomainBannedPackages = ['next-auth', 'next-auth/**'];

// ─── NextAuth: Boundary elements ──────────────────────────────────────────────
/**
 * `src/auth.ts` 단일 파일을 `auth` element로 등록.
 * NextAuth 설정(handlers/auth/signIn/signOut)을 한 파일에 모으고,
 * 이 파일만 next-auth를 import 할 수 있게 제한한다.
 * `mode: 'full'` — 폴더가 아닌 정확한 파일 경로 매칭.
 */
export const nextauthBoundaryElements = [
  { type: 'auth', mode: 'full', pattern: ['src/auth.ts'] },
];

// ─── NextAuth: Boundary rules ─────────────────────────────────────────────────
/**
 * auth.ts는 NextAuth 설정 구성을 위해 api-helper만 import 가능
 * (예: DB 어댑터 초기화, 커스텀 콜백에서 api 조회 등).
 * domain/UI 직접 의존은 금지.
 */
export const nextauthBoundaryRules = [
  { from: { type: 'auth' }, allow: [{ to: { type: 'api-helper' } }] },
];

// ─── NextAuth: Additional allow rules (patch into base rules) ─────────────────
/**
 * 기존 레이어가 auth.ts를 참조할 수 있도록 허용 목록에 추가:
 *   - api-helper → auth  : 서버 액션/핸들러에서 `auth()` 호출로 세션 조회
 *   - page       → auth  : 페이지/레이아웃에서 `auth()`로 서버 사이드 세션 확인
 */
export const nextauthBoundaryAllowPatches = [
  { from: 'api-helper', allow: { to: { type: 'auth' } } },
  { from: 'page', allow: { to: { type: 'auth' } } },
];

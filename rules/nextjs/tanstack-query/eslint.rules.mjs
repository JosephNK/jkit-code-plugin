// =============================================================================
// JKit Next.js — TanStack Query (React Query) 스택 규칙
// =============================================================================

// ─── TanStack Query: Domain banned packages ───────────────────────────────────
/**
 * 도메인 레이어에서 TanStack 패키지 전체 차단.
 * TanStack Query는 React 런타임에 결합된 hook 기반 라이브러리이므로
 * 도메인(순수 TS) 계층에 들어가면 안 된다.
 * React Query 훅은 `src/lib/api/hooks`(api-hook 레이어)에서만 정의한다.
 */
export const tanstackQueryDomainBannedPackages = ['@tanstack/**'];

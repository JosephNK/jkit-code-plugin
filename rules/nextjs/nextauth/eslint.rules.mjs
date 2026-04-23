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

// ─── NextAuth: Layer semantics (glossary) ─────────────────────────────────────
/**
 * 스택이 추가하는 `auth` 레이어의 역할·포함·금지·대표 코드.
 * base 글로서리와 별개로 이 레이어 고유 규약을 명시 — LLM이 `src/auth.ts`를
 * 작성할 때 어떤 형태여야 하고 뭘 넣지 말아야 하는지 판단하는 근거.
 */
export const nextauthLayerSemantics = {
  auth: {
    role:
      'NextAuth 설정 단일 파일 (`src/auth.ts`). `handlers`/`auth`/`signIn`/`signOut`을 export하며, 프로젝트 내에서 이 파일만 `next-auth`를 import 할 수 있다.',
    contains: [
      'NextAuth 설정 (providers·callbacks·session·adapter 등) — `src/auth.ts` (단일 파일)',
    ],
    forbids: [
      '`next-auth` import를 auth 파일 밖으로 누출 (다른 레이어에서 직접 import 금지)',
      'domain/UI 레이어 직접 import (세션 조회는 api-helper 경유)',
      '런타임 비즈니스 로직 (설정 구성·세션 조회 이외)',
    ],
    scope:
      '외부에서 세션이 필요하면 `api-helper` 또는 `page` 레이어에서 `auth()` 호출 (nextauthBoundaryAllowPatches 참조).',
    example: [
      "// src/auth.ts",
      "import NextAuth from 'next-auth';",
      "import Google from 'next-auth/providers/google';",
      "",
      "export const { handlers, auth, signIn, signOut } = NextAuth({",
      "  providers: [Google],",
      "  callbacks: {",
      "    session: ({ session, token }) => ({ ...session, userId: token.sub }),",
      "  },",
      "});",
    ].join('\n'),
  },
};

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

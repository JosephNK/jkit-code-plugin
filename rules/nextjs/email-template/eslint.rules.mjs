// =============================================================================
// JKit Next.js — Email Template 스택 규칙
// -----------------------------------------------------------------------------
// 이메일 템플릿(React Email 등) 디렉토리를 별도 레이어로 격리.
// UI 컴포넌트와 섞이지 않도록 독립된 element로 관리한다.
// =============================================================================

// ─── Email Template: Boundary elements ────────────────────────────────────────
/**
 * `src/lib/email-templates` 디렉토리를 `email-template` element로 등록.
 * 이메일 전송 시 서버에서 렌더링되는 템플릿 전용 공간.
 */
export const emailTemplateBoundaryElements = [
  { type: 'email-template', pattern: ['src/lib/email-templates'] },
];

// ─── Email Template: Boundary rules ───────────────────────────────────────────
/**
 * 이메일 템플릿이 i18n 사전과 공통 타입만 접근하도록 제한.
 * 도메인/API 레이어를 직접 import하면 서버 전용 로직이 이메일 렌더 경로로 새게 된다.
 * 필요한 데이터는 호출자(api-helper)가 props로 주입해야 한다.
 */
export const emailTemplateBoundaryRules = [
  {
    from: { type: 'email-template' },
    allow: [{ to: { type: 'dictionary' } }, { to: { type: 'shared-type' } }],
  },
];

// ─── Email Template: Additional allow rules (patch into base rules) ───────────
/**
 * api-helper가 이메일 템플릿을 import하여 렌더 후 발송할 수 있도록 허용.
 * (이메일 발송의 최상위 조립 지점이 api-helper인 설계)
 */
export const emailTemplateBoundaryAllowPatches = [
  { from: 'api-helper', allow: { to: { type: 'email-template' } } },
];

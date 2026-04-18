// =============================================================================
// JKit Next.js — No Utility CSS 규칙
// -----------------------------------------------------------------------------
// Utility-class CSS 프레임워크(Tailwind, UnoCSS, WindiCSS 등) 전역 차단.
// UI 라이브러리 무관한 프로젝트 정책이므로 mantine 스택과 분리되어 단독으로 존재.
//
// eslint.template.mjs의 {{RESTRICTED_PATTERNS}} 자리에 주입된다.
// =============================================================================

// ─── No Utility CSS: Restricted import patterns ──────────────────────────────
/**
 * Utility CSS 프레임워크 import 차단.
 *
 * 이유:
 * - 컴포넌트 기반 디자인 시스템과 utility CSS는 토큰 시스템이 이중화되어
 *   번들 크기 증가 + 테마 관리 분산을 유발한다.
 * - 스타일 전략을 "UI lib style props → style prop → CSS Modules" 한 줄기로
 *   단일화해야 유지보수성이 확보된다.
 *
 * CSS-in-JS 차단은 UI lib마다 다른 결정 사항이므로 여기서는 다루지 않는다
 * (각 UI lib 스택의 책임).
 */
export const noUtilityCssRestrictedPatterns = [
  {
    group: [
      'tailwindcss',
      'tailwindcss/**',
      'unocss',
      'unocss/**',
      'windicss',
      'windicss/**',
    ],
    message:
      'Utility CSS frameworks are not allowed. Use the project UI library style props or CSS Modules.',
  },
];

// =============================================================================
// JKit Next.js — Stylelint 베이스 설정
// -----------------------------------------------------------------------------
// 모든 Next.js 프로젝트에 기본 적용되는 stylelint 규칙 묶음.
// `stylelint.template.mjs` → 사용자 프로젝트의 `stylelint.config.mjs`에서
// spread 되어 최종 config로 병합된다.
// =============================================================================

// ─── 접근성·렌더 경로 보호: var() fallback 필수 속성 목록 ──────────────────────
/**
 * 이 속성들에서 `var(--token)`을 fallback 없이 쓰면 경고.
 *
 * 이유:
 * - CSS 변수가 미정의일 때 **선언 전체가 invalid-at-computed-value**로 처리된다.
 *   → 브라우저 기본 outline, 기본 색까지 날아가 포커스 링이 사라지거나 FOUC 발생.
 * - Theme provider(Mantine 등) 하이드레이션 이전 경로에서 재현:
 *   · SSR 초기 페인트
 *   · `error.tsx` / `not-found.tsx` / layout root 이전
 *   · Error boundary fallback
 *   · 테마 CSS 번들이 JS 테마 주입보다 먼저 도달한 순간
 * - WCAG 2.4.7 (포커스 가시성) 위반 소지.
 *
 * 해결: `var(--token, <literal-fallback>)` 형태로 2번째 인자 제공.
 */
const FALLBACK_REQUIRED_PROPS = [
  'outline',
  'outline-color',
  'box-shadow',
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
].join('|');

// ─── Export: 베이스 config 블록 ───────────────────────────────────────────────
/**
 * 템플릿에서 `...stylelintBaseConfig`로 spread 되는 config 조각.
 *
 * - `extends: ['stylelint-config-standard']`: stylelint 공식 권장 룰셋
 * - `rules`: jkit 고유 룰 (현재는 var fallback만)
 *
 * 사용자 override는 템플릿 쪽 `rules`에 덧붙여 우선순위를 확보한다.
 */
export const stylelintBaseConfig = {
  extends: ['stylelint-config-standard'],
  rules: {
    // fallback 없는 var()는 접근성·초기 렌더 리스크로 차단
    'declaration-property-value-disallowed-list': [
      {
        // 정규식 키: 위 속성 목록과 일치하는 프로퍼티에만 적용
        [`/^(${FALLBACK_REQUIRED_PROPS})$/`]: [
          // 정규식 값: 값의 끝이 `var(--x)`로 끝나고 fallback(`,`)이 없을 때 매칭
          // 예: `2px solid var(--mantine-primary-color-filled)` → 위반
          //     `2px solid var(--mantine-primary-color-filled, #005da7)` → 통과
          '/var\\(--[^,)]+\\)$/',
        ],
      },
      {
        message:
          'CSS variables in accessibility-critical declarations must include a fallback value. ' +
          'Use `var(--token, <fallback>)`. Reason: a single undefined var() invalidates the entire ' +
          'declaration (invalid-at-computed-value), removing browser default focus rings and causing ' +
          'FOUC on pre-hydration render paths (error.tsx, not-found, SSR initial paint).',
        severity: 'warning',
      },
    ],
  },
};

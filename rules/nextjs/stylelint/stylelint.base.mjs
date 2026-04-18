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

// ─── 토큰 하드코딩 차단 대상 속성 ─────────────────────────────────────────────
/**
 * `stylelint-declaration-strict-value`로 hard-coded value를 금지하는 속성 목록.
 *
 * 이유:
 * - 컨벤션 C13: 디자인 토큰은 `src/theme.ts` (또는 CSS 변수)에 정의되고, CSS에선
 *   `var(--token)` 또는 fallback 포함 형태로만 소비되어야 한다. 특정 CSS 파일에서
 *   `color: #ff0000` / `border-radius: 12px` 처럼 리터럴이 섞이면 다크/라이트
 *   테마 전환이 깨지고 토큰 정책이 무력화된다.
 *
 * 범위 결정 배경:
 * - `/color$/` 정규식으로 `color`, `background-color`, `border-color`,
 *   `outline-color` 등 색 계열을 한번에 커버.
 * - `fill`/`stroke`는 SVG 토큰 경로.
 * - `font-family`/`border-radius`/`box-shadow`는 ESLint `no-inline-style-tokens`와
 *   대칭 (JSX 인라인 style + CSS 양쪽에서 동일 정책).
 */
const STRICT_VALUE_PROPS = [
  '/color$/', // color, background-color, border-color, outline-color 등
  'fill',
  'stroke',
  'font-family',
  'border-radius',
  'box-shadow',
];

/**
 * strict-value 검사에서 예외로 통과시킬 값.
 *
 * - `var(...)`: 토큰 정본 소비 경로
 * - `transparent` / `inherit` / `currentColor` / `unset` / `initial`: CSS 키워드
 * - `none` / `0` / `auto`: shadow/radius의 기본값 해제 용도
 */
const STRICT_VALUE_IGNORES = [
  '/^var\\(/',
  'transparent',
  'inherit',
  'currentColor',
  'unset',
  'initial',
  'none',
  '0',
  'auto',
];

// ─── Export: 베이스 config 블록 ───────────────────────────────────────────────
/**
 * 템플릿에서 `...stylelintBaseConfig`로 spread 되는 config 조각.
 *
 * - `extends: ['stylelint-config-standard']`: stylelint 공식 권장 룰셋
 * - `plugins`: `stylelint-declaration-strict-value` (토큰 하드코딩 차단)
 * - `rules`:
 *   · `declaration-property-value-disallowed-list` — var() fallback 강제
 *   · `scale-unlimited/declaration-strict-value` — 색/radius/shadow 등 토큰 리터럴 차단
 *
 * 사용자 override는 템플릿 쪽 `rules`에 덧붙여 우선순위를 확보한다.
 */
export const stylelintBaseConfig = {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
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
    // 디자인 토큰 리터럴 차단 (컨벤션 C13, ESLint `no-inline-style-tokens`와 대칭)
    'scale-unlimited/declaration-strict-value': [
      STRICT_VALUE_PROPS,
      {
        ignoreValues: STRICT_VALUE_IGNORES,
        ignoreFunctions: ['var'],
        message: (property) =>
          `Expected \`var(--token, <fallback>)\` or design-token reference for \`${property}\`. ` +
          'Hardcoded values bypass theme tokens (src/theme.ts) and break dark/light switching.',
      },
    ],
  },
};

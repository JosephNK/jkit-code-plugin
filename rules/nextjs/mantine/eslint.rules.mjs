// =============================================================================
// JKit Next.js — Mantine UI 스택 규칙
// -----------------------------------------------------------------------------
// Mantine을 사용할 때 추가되는 ESLint 규칙 묶음. eslint.template.mjs의
// {{STACK_IMPORTS}} / {{RESTRICTED_PATTERNS}} / {{RESTRICTED_SYNTAX}} /
// {{DOMAIN_BANNED}} 자리에 주입된다.
// =============================================================================

// ─── Mantine: Restricted import patterns ──────────────────────────────────────
/**
 * 스타일링 전략 단일화를 위해 다른 CSS 전략을 차단한다.
 * Mantine은 자체 style props + CSS Modules를 전제로 디자인되어 있어,
 * Tailwind나 Emotion을 혼용하면 번들 크기 증가 + 테마 토큰 이중화 문제가 발생.
 */
export const mantineRestrictedPatterns = [
  {
    // Utility CSS 프레임워크 차단 — Mantine style props로 일관화
    group: ['tailwindcss', 'tailwindcss/**', 'unocss', 'unocss/**', 'windicss', 'windicss/**'],
    message: 'Utility CSS frameworks are not allowed. Use Mantine style props.',
  },
  {
    // CSS-in-JS 라이브러리 차단 — Mantine은 Emotion 기반이지만 직접 사용은 금지 (이중 설정 방지)
    group: ['@emotion/*', 'styled-components', 'styled-jsx', 'styled-jsx/**'],
    message: 'CSS-in-JS libraries are not allowed. Use Mantine style props or CSS Modules.',
  },
];

// ─── Mantine: Restricted syntax (no-restricted-syntax entries) ────────────────
/**
 * Mantine 컴포넌트의 `component="a"` prop 사용 금지.
 * 이유: 내부 라우팅을 anchor 태그로 하면 Next.js의 클라이언트 네비게이션을 우회해
 *       **전체 페이지 리로드**가 발생한다. Next.js `Link`를 `component`로 전달해야
 *       SPA 네비게이션이 유지된다.
 *
 * Selector 해설: JSX attribute 중 name이 'component', value가 문자열 'a'인 경우
 * 예: <Button component="a" href="/foo">  ← 금지
 *     <Button component={Link} href="/foo"> ← 권장
 */
export const mantineRestrictedSyntax = [
  {
    selector: "JSXAttribute[name.name='component'][value.value='a']",
    message:
      'Do not use component="a" for internal links — it causes full page reload. Use component={Link} from next/link instead.',
  },
];

// ─── Mantine: Domain banned packages ──────────────────────────────────────────
/**
 * 도메인 레이어에서 Mantine 패키지 전체 차단.
 * 도메인은 UI 프레임워크에 의존하면 안 되므로, `@mantine/core` 등 어떤 하위
 * 패키지도 import 금지.
 */
export const mantineDomainBannedPackages = ['@mantine/**'];

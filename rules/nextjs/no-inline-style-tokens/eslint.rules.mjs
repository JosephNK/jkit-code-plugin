// =============================================================================
// JKit Next.js — No Inline Style Tokens 규칙
// -----------------------------------------------------------------------------
// JSX 인라인 `style={{ ... }}` 객체의 토큰 key(폰트/라운드/그림자/색상 계열)에
// Literal 값 하드코딩을 차단한다. stylelint가 커버하지 못하는 .tsx 인라인
// 스타일 공백을 메우는 룰.
//
// eslint.template.mjs의 {{RESTRICTED_SYNTAX}} 자리에 주입된다.
// =============================================================================

// 색상/레이아웃 토큰 key 목록 (camelCase). Identifier key와 string-literal key
// 양쪽 selector에 공통으로 사용하기 위해 상수로 분리.
const TOKEN_KEYS =
  'fontFamily|borderRadius|boxShadow|color|backgroundColor|background|borderColor|outlineColor|fill|stroke';

// ─── No Inline Style Tokens: Restricted syntax ────────────────────────────────
/**
 * JSX `style` prop 객체의 토큰 key에 Literal 값이 직접 들어가는 것을 차단.
 *
 * 이유:
 * - stylelint는 CSS kebab-case(`border-radius` 등)만 가드한다. 프로젝트에서
 *   `style={{ borderRadius: 12 }}` 형태로 JSX 인라인 스타일을 쓰면 기존 토큰
 *   가드가 모두 우회된다.
 * - theme 기반 디자인 시스템(Mantine/antd 등)은 다크/라이트 전환과 토큰 일관성을
 *   theme 객체(또는 CSS 변수)에 의존하므로 하드코딩은 테마 전환을 깨뜨린다.
 *
 * 허용:
 * - MemberExpression: `theme.radius.sm`, `theme.colors.primary[6]`, `token.colorPrimary`
 * - `var(...)` 문자열: `'var(--mantine-shadow-sm)'` — negative lookahead로 통과
 * - TemplateLiteral: `\`${x}px\`` — 동적 값 escape
 * - Identifier: `radiusVar` — 변수 참조
 *
 * 차단:
 * - numeric Literal: `borderRadius: 12`
 * - non-`var()` string Literal: `fontFamily: 'Inter'`, `color: '#ff0000'`,
 *   `boxShadow: '0 2px 4px ...'`
 *
 * 한계:
 * - Inline `style` prop 내부만 커버. 객체 리터럴이 별도 변수(`const cfg = { ... }`)로
 *   분리되어 style에 spread되는 케이스는 AST로 안정적으로 스코프할 수 없음.
 * - CSS 파일(`.css`, `.module.css`)의 토큰 하드코딩은 stylelint 영역.
 */
export const noInlineStyleTokensRestrictedSyntax = [
  // (a) 표준 케이스: identifier key (JSX 관용)
  {
    selector:
      `JSXAttribute[name.name='style'] ` +
      `Property[key.type='Identifier'][key.name=/^(${TOKEN_KEYS})$/]` +
      `[value.type='Literal'][value.value=/^(?!var\\()/]`,
    message:
      'Do not hardcode inline style tokens in JSX style prop. Use theme references (e.g., theme.radius.*, theme.colors.*, theme.shadows.*, var(--mantine-*)) instead of raw literals.',
  },
  // (b) 엣지 케이스: string-literal key (`{ 'fontFamily': 'x' }`)
  {
    selector:
      `JSXAttribute[name.name='style'] ` +
      `Property[key.type='Literal'][key.value=/^(${TOKEN_KEYS})$/]` +
      `[value.type='Literal'][value.value=/^(?!var\\()/]`,
    message:
      'Do not hardcode inline style tokens in JSX style prop (string-literal key). Use theme references.',
  },
];

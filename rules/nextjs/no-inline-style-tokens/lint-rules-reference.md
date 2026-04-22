<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nextjs/no-inline-style-tokens/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/no-inline-style-tokens)

## Restricted Syntax (AST 금지 구문)

JSX `style` prop 객체의 토큰 key에 Literal 값이 직접 들어가는 것을 차단.

이유:
- stylelint는 CSS kebab-case(`border-radius` 등)만 가드한다. 프로젝트에서
  `style={{ borderRadius: 12 }}` 형태로 JSX 인라인 스타일을 쓰면 기존 토큰
  가드가 모두 우회된다.
- theme 기반 디자인 시스템(Mantine/antd 등)은 다크/라이트 전환과 토큰 일관성을
  theme 객체(또는 CSS 변수)에 의존하므로 하드코딩은 테마 전환을 깨뜨린다.

허용:
- MemberExpression: `theme.radius.sm`, `theme.colors.primary[6]`, `token.colorPrimary`
- `var(...)` 문자열: `'var(--mantine-shadow-sm)'` — negative lookahead로 통과
- TemplateLiteral: `\`${x}px\`` — 동적 값 escape
- Identifier: `radiusVar` — 변수 참조

차단:
- numeric Literal: `borderRadius: 12`
- non-`var()` string Literal: `fontFamily: 'Inter'`, `color: '#ff0000'`,
  `boxShadow: '0 2px 4px ...'`

한계:
- Inline `style` prop 내부만 커버. 객체 리터럴이 별도 변수(`const cfg = { ... }`)로
  분리되어 style에 spread되는 케이스는 AST로 안정적으로 스코프할 수 없음.
- CSS 파일(`.css`, `.module.css`)의 토큰 하드코딩은 stylelint 영역.

| Selector | 메시지 |
| --- | --- |
| `JSXAttribute[name.name='style'] Property[key.type='Identifier'][key.name=/^(fontFamily\|borderRadius\|boxShadow\|color\|backgroundColor\|background\|borderColor\|outlineColor\|fill\|stroke)$/][value.type='Literal'][value.value=/^(?!var\()/]` | Do not hardcode inline style tokens in JSX style prop. Use theme references (e.g., theme.radius.*, theme.colors.*, theme.shadows.*, var(--mantine-*)) instead of raw literals. |
| `JSXAttribute[name.name='style'] Property[key.type='Literal'][key.value=/^(fontFamily\|borderRadius\|boxShadow\|color\|backgroundColor\|background\|borderColor\|outlineColor\|fill\|stroke)$/][value.type='Literal'][value.value=/^(?!var\()/]` | Do not hardcode inline style tokens in JSX style prop (string-literal key). Use theme references. |

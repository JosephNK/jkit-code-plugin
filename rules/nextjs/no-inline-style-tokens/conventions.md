## No Inline Style Tokens

JSX 인라인 `style={{ ... }}` 객체의 토큰 key(폰트/라운드/그림자/색상 계열)에 Literal 값을 하드코딩하지 않는다. stylelint는 `.css`/`.module.css`만 커버하므로, `.tsx`의 인라인 스타일 경로로 토큰 정책이 우회되는 것을 ESLint로 차단한다.

### Enforced keys (camelCase)

레이아웃 계열:

- `fontFamily`
- `borderRadius`
- `boxShadow`

색상 계열:

- `color`
- `backgroundColor`
- `background`
- `borderColor`
- `outlineColor`
- `fill`
- `stroke`

Identifier key(`{ color: ... }`)와 string-literal key(`{ 'color': ... }`) 양쪽 모두 탐지한다.

### 허용 / 차단

| 패턴                                                               | 결과    | 이유                                          |
| ------------------------------------------------------------------ | ------- | --------------------------------------------- |
| `style={{ borderRadius: theme.radius.sm }}`                        | ✅ 허용 | MemberExpression — theme 참조                 |
| `style={{ color: theme.colors.primary[6] }}`                       | ✅ 허용 | MemberExpression                              |
| `style={{ fontFamily: 'var(--mantine-font-family)' }}`             | ✅ 허용 | `var(...)` 문자열                             |
| `style={{ backgroundColor: 'var(--mantine-color-body)' }}`         | ✅ 허용 | `var(...)` 문자열                             |
| `style={{ boxShadow: \`0 ${depth}px 4px ${color}\` }}`             | ✅ 허용 | TemplateLiteral — 동적 값                     |
| `style={{ borderRadius: radiusVar }}`                              | ✅ 허용 | Identifier — 변수 참조                        |
| `style={{ borderRadius: 12 }}`                                     | ❌ 차단 | numeric Literal — theme.radius 사용해야       |
| `style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}`               | ❌ 차단 | string Literal — theme.shadows 사용해야       |
| `style={{ fontFamily: 'Inter' }}`                                  | ❌ 차단 | string Literal — theme.fontFamily 사용해야    |
| `style={{ color: '#ff0000' }}`                                     | ❌ 차단 | string Literal — theme.colors 사용해야        |
| `style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}`                   | ❌ 차단 | string Literal — theme.colors 사용해야        |
| `style={{ 'fontFamily': 'Inter' }}`                                | ❌ 차단 | string-literal key도 탐지됨                   |

### Scope / Compatibility

- **Opt-in 스택**. Mantine/antd 또는 자체 theme system을 쓰는 프로젝트에서 권장.
- Tailwind 기반 프로젝트에서 주된 토큰 하드코딩 벡터는 `className="bg-[#hex] rounded-[12px]"` 같은 arbitrary value이며, 본 룰은 그 경로를 다루지 않는다 — Tailwind 병용 시 별도 룰(`eslint-plugin-tailwindcss` 등) 사용.
- `no-utility-css`, `stylelint`, `theme` 스택과 **직교**한다 — 함께 켜도 충돌 없음.
- styled-components / emotion 등 **CSS-in-JS 템플릿 리터럴**은 ESLint/stylelint 기본 커버 밖이다. 필요 시 `stylelint-processor-styled-components` 같은 프로세서 병행.

### Limitations

- Inline `style` prop 내부만 커버한다. `const cfg = { fontFamily: 'x' }` 처럼 **style 밖의 객체 리터럴**은 이 룰 대상 아님 (토큰 의도인지 일반 설정인지 AST로 구분 불가).
- `Literal` 값만 검사한다. MemberExpression / Identifier / TemplateLiteral은 런타임에 어떤 값이 오는지 정적 분석 불가 — 의도적으로 통과.

### Coverage

| Surface | Enforced by |
| --- | --- |
| JSX inline `style={{ ... }}` | **이 ESLint 룰** (본 문서) |
| `.css` / `.module.css` / `.scss` | `stylelint` 스택 (`scale-unlimited/declaration-strict-value`, var fallback) |
| styled-components / emotion 템플릿 | (opt-in) `stylelint-processor-styled-components` — 프로젝트 선택 |
| `style` prop 밖 객체 리터럴 | PR 리뷰 (린터로 안정 스코프 불가) |

ESLint와 stylelint가 **동일한 정책**(`var()` 또는 theme 참조만 허용)을 양쪽 surface에 대칭으로 적용한다.

### Documentation Reference

- Always check latest ESLint / esquery docs via Context7 MCP when adjusting selectors
- Prefer Context7 docs over training data (training cutoff)

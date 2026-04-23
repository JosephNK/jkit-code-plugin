<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/mantine/eslint.rules.mjs -->

# Lint Rules Reference (nextjs/mantine)

## Restricted Patterns (Import 금지 패턴)

Mantine 한정 CSS-in-JS 차단.
Mantine은 내부적으로 Emotion을 쓰지만 사용자 코드에서 직접 Emotion/styled-*
라이브러리를 쓰면 이중 설정(Emotion 캐시·테마 프로바이더가 둘)이 되어
스타일 계산 타이밍·테마 토큰 동기화에 문제가 생긴다.

| 패턴 | 메시지 |
| --- | --- |
| `@emotion/*`, `styled-components`, `styled-jsx`, `styled-jsx/**` | CSS-in-JS libraries are not allowed. Use Mantine style props or CSS Modules. |

## Restricted Syntax (AST 금지 구문)

Mantine 컴포넌트의 `component="a"` prop 사용 금지.
이유: 내부 라우팅을 anchor 태그로 하면 Next.js의 클라이언트 네비게이션을 우회해
      **전체 페이지 리로드**가 발생한다. Next.js `Link`를 `component`로 전달해야
      SPA 네비게이션이 유지된다.

Selector 해설: JSX attribute 중 name이 'component', value가 문자열 'a'인 경우
예: <Button component="a" href="/foo">  ← 금지
    <Button component={Link} href="/foo"> ← 권장

| Selector | 메시지 |
| --- | --- |
| `JSXAttribute[name.name='component'][value.value='a']` | Do not use component="a" for internal links — it causes full page reload. Use component={Link} from next/link instead. |

## Domain Purity (도메인 순수성)

도메인 레이어에서 Mantine 패키지 전체 차단.
도메인은 UI 프레임워크에 의존하면 안 되므로, `@mantine/core` 등 어떤 하위
패키지도 import 금지.

### 도메인 레이어 금지 패키지

- `@mantine/**`

/**
 * AST selector 기반 금지 구문.
 * - `React.FC` / `React.FunctionComponent`: children 암묵 포함·generic 불편 — 명시적 props 타입 사용.
 * - polymorphic `component="a"` (Mantine·MUI·Chakra 등): Next.js client-side 라우팅 우회로 전체 페이지 reload 유발. 내부 링크는 `next/link`의 `Link`, 외부 링크는 일반 `<a>` 또는 디자인 시스템 전용 anchor(Mantine `Anchor`, antd `Typography.Link` 등) 사용.
 */
export const baseRestrictedSyntax = [
  {
    selector:
      "TSTypeReference[typeName.object.name='React'][typeName.property.name='FC']",
    message: "Use explicit props typing instead of React.FC.",
  },
  {
    selector:
      "TSTypeReference[typeName.object.name='React'][typeName.property.name='FunctionComponent']",
    message: "Use explicit props typing instead of React.FunctionComponent.",
  },
  {
    selector: "JSXAttribute[name.name='component'][value.value='a']",
    message:
      'Do not use component="a" — bypasses Next.js client-side routing and causes a full page reload. Internal links: component={Link} from next/link. External links: a plain <a target="_blank" rel="noopener noreferrer"> element or the design system\'s dedicated anchor component (Mantine Anchor, antd Typography.Link, etc.).',
  },
];

/**
 * AST selector 기반 금지 구문. `React.FC` / `React.FunctionComponent` 금지 —
 * children 암묵 포함, generic 어려움. 명시적 props 타입 사용.
 */
export const baseRestrictedSyntax = [
  {
    selector: "TSTypeReference[typeName.object.name='React'][typeName.property.name='FC']",
    message: 'Use explicit props typing instead of React.FC.',
  },
  {
    selector: "TSTypeReference[typeName.object.name='React'][typeName.property.name='FunctionComponent']",
    message: 'Use explicit props typing instead of React.FunctionComponent.',
  },
];

// =============================================================================
// Rule: no-dto-oneof
// -----------------------------------------------------------------------------
// DTO 필드의 `@ApiProperty` / `@ApiPropertyOptional` 데코레이터에서 `oneOf`
// 옵션 사용을 금지한다.
//
// 이유: OpenAPI 의 `oneOf` 는 동적 타입 판별이 필요해 Swagger Codegen 및
//       다수 언어(Dart, Swift, Kotlin 등) 의 클라이언트 생성기가 제대로
//       처리하지 못한다. 클라이언트 측에서 런타임 타입 가드를 강제하게 되므로
//       API 계약으로 부적합. 별도 필드로 분리하거나 공용 DTO 로 통합할 것.
//
// 검사 방법:
//   - PropertyDefinition 의 decorator 중 CallExpression 형태
//   - callee 가 `ApiProperty` 또는 `ApiPropertyOptional`
//   - 첫 번째 인자가 ObjectExpression 이고 그 안에 `oneOf` key 가 존재
// =============================================================================

const TARGET_DECORATORS = new Set(['ApiProperty', 'ApiPropertyOptional']);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `oneOf` option in @ApiProperty / @ApiPropertyOptional (not supported by cross-language client codegen)',
    },
    messages: {
      noOneOf:
        'DTO field "{{ name }}" uses `oneOf` in @{{ decorator }}. Consolidate into a shared DTO or split into separate fields. (conventions.md: Union type rules)',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        const decorators = node.decorators ?? [];
        if (decorators.length === 0) return;

        const fieldName = node.key?.name ?? node.key?.value ?? 'unknown';

        for (const decorator of decorators) {
          const expr = decorator.expression;
          if (!expr || expr.type !== 'CallExpression') continue;

          const decoratorName = expr.callee?.name;
          if (!TARGET_DECORATORS.has(decoratorName)) continue;

          const firstArg = expr.arguments?.[0];
          if (!firstArg || firstArg.type !== 'ObjectExpression') continue;

          const hasOneOf = firstArg.properties.some((prop) => {
            if (prop.type !== 'Property') return false;
            const key = prop.key;
            // { oneOf: ... } 과 { 'oneOf': ... } 양쪽 처리
            return (
              (key.type === 'Identifier' && key.name === 'oneOf') ||
              (key.type === 'Literal' && key.value === 'oneOf')
            );
          });

          if (hasOneOf) {
            context.report({
              node: firstArg,
              messageId: 'noOneOf',
              data: { name: fieldName, decorator: decoratorName },
            });
          }
        }
      },
    };
  },
};

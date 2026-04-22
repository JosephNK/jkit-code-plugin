// =============================================================================
// Rule: dto-nullable-match
// -----------------------------------------------------------------------------
// DTO 필드가 null을 포함한 유니온 타입일 때 `@ApiProperty` /
// `@ApiPropertyOptional` 데코레이터 옵션이 Swagger/OpenAPI 스펙과 정합하도록
// 강제한다.
//
// 검사 규칙:
//   1) T | null  (T = string/number/boolean 등 원시) → `nullable: true` 필수
//   2) Date | null                                   → `type: String`,
//                                                      `format: 'date-time'`,
//                                                      `nullable: true` 필수
//
// 이유: TypeScript 타입 정보는 런타임에 사라져 Swagger가 알 수 없다.
//       결과적으로 생성된 OpenAPI 스펙이 non-nullable로 기술되어 클라이언트
//       codegen(Dart/Swift/Kotlin 등)이 null 허용을 누락한다.
//       Date 는 Swagger가 기본적으로 object 로 간주하므로 `type: String` +
//       `format: 'date-time'` 명시가 없으면 ISO8601 문자열 통신이 깨진다.
//
// 검사 제외:
//   - 데코레이터 자체가 없는 필드 — `require-api-property` 가 별도로 처리.
//   - 옵션 인자가 ObjectExpression 이 아닌 경우 — 통상 존재하지 않지만
//     방어적으로 스킵.
// =============================================================================

const TARGET_DECORATORS = new Set(['ApiProperty', 'ApiPropertyOptional']);

function unionHasNull(typeAnn) {
  return typeAnn.types.some((t) => t.type === 'TSNullKeyword');
}

function unionHasDate(typeAnn) {
  return typeAnn.types.some(
    (t) => t.type === 'TSTypeReference' && t.typeName?.name === 'Date',
  );
}

function findApiPropertyDecorator(decorators) {
  return decorators.find((d) => {
    const expr = d.expression;
    if (!expr || expr.type !== 'CallExpression') return false;
    return TARGET_DECORATORS.has(expr.callee?.name);
  });
}

function getOptionsObject(decorator) {
  const firstArg = decorator.expression.arguments?.[0];
  return firstArg && firstArg.type === 'ObjectExpression' ? firstArg : null;
}

function findProperty(objExpr, keyName) {
  if (!objExpr) return null;
  return objExpr.properties.find((prop) => {
    if (prop.type !== 'Property') return false;
    const k = prop.key;
    return (
      (k.type === 'Identifier' && k.name === keyName) ||
      (k.type === 'Literal' && k.value === keyName)
    );
  });
}

/**
 * 옵션 프로퍼티의 값을 단순 JS 값으로 해석.
 *   - Literal          → Literal.value (boolean/string 등)
 *   - Identifier       → Identifier.name (e.g., `String` 생성자 참조)
 *   - 그 외 (복합 표현식) → undefined
 */
function propertyValue(prop) {
  if (!prop) return undefined;
  const v = prop.value;
  if (v.type === 'Literal') return v.value;
  if (v.type === 'Identifier') return v.name;
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require @ApiProperty options (nullable, type, format) to match DTO field null/Date union types',
    },
    messages: {
      missingNullable:
        'DTO field "{{ name }}" is `T | null` but @{{ decorator }} is missing `nullable: true`. (conventions.md: Union type rules)',
      missingDateType:
        'DTO field "{{ name }}" is `Date | null` but @{{ decorator }} is missing `type: String`. (conventions.md: Union type rules)',
      missingDateFormat:
        'DTO field "{{ name }}" is `Date | null` but @{{ decorator }} is missing `format: \'date-time\'`. (conventions.md: Union type rules)',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        const typeAnn = node.typeAnnotation?.typeAnnotation;
        if (!typeAnn || typeAnn.type !== 'TSUnionType') return;
        if (!unionHasNull(typeAnn)) return;

        const fieldName = node.key?.name ?? node.key?.value ?? 'unknown';
        const decorator = findApiPropertyDecorator(node.decorators ?? []);
        // 데코레이터 자체 누락은 require-api-property 가 담당 — 중복 경고 방지
        if (!decorator) return;

        const decoratorName = decorator.expression.callee.name;
        const options = getOptionsObject(decorator);

        // [1] nullable: true 필수
        const nullableProp = findProperty(options, 'nullable');
        if (propertyValue(nullableProp) !== true) {
          context.report({
            node: decorator,
            messageId: 'missingNullable',
            data: { name: fieldName, decorator: decoratorName },
          });
        }

        // [2] Date | null 인 경우 type/format 도 검사
        if (unionHasDate(typeAnn)) {
          const typeProp = findProperty(options, 'type');
          if (propertyValue(typeProp) !== 'String') {
            context.report({
              node: decorator,
              messageId: 'missingDateType',
              data: { name: fieldName, decorator: decoratorName },
            });
          }

          const formatProp = findProperty(options, 'format');
          if (propertyValue(formatProp) !== 'date-time') {
            context.report({
              node: decorator,
              messageId: 'missingDateFormat',
              data: { name: fieldName, decorator: decoratorName },
            });
          }
        }
      },
    };
  },
};

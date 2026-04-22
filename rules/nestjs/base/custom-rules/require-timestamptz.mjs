// =============================================================================
// Rule: require-timestamptz
// -----------------------------------------------------------------------------
// TypeORM Date 컬럼에 `type: 'timestamptz'` 옵션 강제 (PostgreSQL).
//
// 이유:
//   - 기본 timestamp(= timestamp without time zone)는 타임존 정보가 없어
//     다중 지역 서비스에서 시간 비교/변환 오류 원인이 된다.
//   - timestamptz는 DB에 UTC로 저장하고 세션 타임존에 맞춰 변환 — 안전한 기본값.
//   - 한 번 마이그레이션으로 놓치면 이후 축적된 데이터 수정 비용이 크므로 컴파일타임에 차단.
//
// 검사 대상: TypeORM 날짜 데코레이터(@Column/@CreateDateColumn/
//           @UpdateDateColumn/@DeleteDateColumn)가 붙은 Date 타입 필드.
// =============================================================================

const DATE_DECORATORS = new Set([
  'Column',
  'CreateDateColumn',
  'UpdateDateColumn',
  'DeleteDateColumn',
]);

/**
 * Date 또는 Date | null 타입인지 확인.
 */
function isDateType(typeAnnotation) {
  if (!typeAnnotation) return false;
  const ann = typeAnnotation.typeAnnotation;
  if (!ann) return false;

  // Date
  if (
    ann.type === 'TSTypeReference' &&
    ann.typeName?.name === 'Date'
  ) {
    return true;
  }

  // Date | null
  if (ann.type === 'TSUnionType') {
    return ann.types.some(
      (t) => t.type === 'TSTypeReference' && t.typeName?.name === 'Date',
    );
  }

  return false;
}

/**
 * Get decorator name from a decorator node.
 */
function getDecoratorName(decorator) {
  const expr = decorator.expression;
  if (expr.type === 'CallExpression') {
    return expr.callee?.name;
  }
  return expr?.name;
}

/**
 * Check if a decorator call has `type: 'timestamptz'` in its first argument.
 */
function hasTimestamptz(decorator) {
  const expr = decorator.expression;
  if (expr.type !== 'CallExpression') return false;

  const firstArg = expr.arguments?.[0];
  if (!firstArg || firstArg.type !== 'ObjectExpression') return false;

  return firstArg.properties.some(
    (p) =>
      p.type === 'Property' &&
      p.key?.name === 'type' &&
      p.value?.value === 'timestamptz',
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require type: "timestamptz" on all TypeORM Date columns',
    },
    messages: {
      missingTimestamptz:
        'Date column "{{ name }}" must use type: \'timestamptz\'. (conventions.md: Date columns)',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        if (!isDateType(node.typeAnnotation)) return;

        const decorators = node.decorators ?? [];
        const dateDecorator = decorators.find((d) =>
          DATE_DECORATORS.has(getDecoratorName(d)),
        );

        if (!dateDecorator) return;

        if (!hasTimestamptz(dateDecorator)) {
          context.report({
            node: node.key,
            messageId: 'missingTimestamptz',
            data: { name: node.key.name ?? node.key.value ?? 'unknown' },
          });
        }
      },
    };
  },
};

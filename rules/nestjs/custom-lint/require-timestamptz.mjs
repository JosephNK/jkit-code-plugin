const DATE_DECORATORS = new Set([
  'Column',
  'CreateDateColumn',
  'UpdateDateColumn',
  'DeleteDateColumn',
]);

/**
 * Check if a TypeAnnotation resolves to Date or Date | null.
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

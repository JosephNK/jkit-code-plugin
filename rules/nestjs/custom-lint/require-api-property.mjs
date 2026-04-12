/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require @ApiProperty or @ApiPropertyOptional on all public DTO fields',
    },
    messages: {
      missing:
        'DTO field "{{ name }}" must have @ApiProperty or @ApiPropertyOptional decorator. (conventions.md: Response DTO)',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        // Skip static, private, protected fields
        if (node.static) return;
        if (node.accessibility === 'private') return;
        if (node.accessibility === 'protected') return;

        // Must have readonly (already enforced separately, but guard here)
        if (!node.readonly) return;

        const decorators = node.decorators ?? [];
        const hasApiDecorator = decorators.some((d) => {
          const expr = d.expression;
          // @ApiProperty() or @ApiPropertyOptional()
          const name =
            expr.type === 'CallExpression' ? expr.callee?.name : expr?.name;
          return name === 'ApiProperty' || name === 'ApiPropertyOptional';
        });

        if (!hasApiDecorator) {
          context.report({
            node: node.key,
            messageId: 'missing',
            data: { name: node.key.name ?? node.key.value ?? 'unknown' },
          });
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce DTO naming: use *DataResponseDto or *ItemDto instead of bare *ResponseDto / *DataDto',
    },
    messages: {
      noResponseDto:
        'Class "{{ name }}" uses bare *ResponseDto suffix. Use *DataResponseDto or *ItemDto instead. (conventions.md: Naming Convention)',
      noDataDto:
        'Class "{{ name }}" uses *DataDto suffix. Use *DataResponseDto instead. (conventions.md: Naming Convention)',
    },
    schema: [],
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        const name = node.id?.name;
        if (!name) return;

        // Allow *DataResponseDto — this is the correct naming
        if (name.endsWith('DataResponseDto')) return;

        // Allow *ItemDto — this is the correct naming
        if (name.endsWith('ItemDto')) return;

        // Warn on bare *ResponseDto (e.g. FooResponseDto)
        if (name.endsWith('ResponseDto')) {
          context.report({
            node: node.id,
            messageId: 'noResponseDto',
            data: { name },
          });
          return;
        }

        // Warn on *DataDto (e.g. FooDataDto, FooListDataDto)
        if (name.endsWith('DataDto')) {
          context.report({
            node: node.id,
            messageId: 'noDataDto',
            data: { name },
          });
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Restrict union types in DTO fields: no T | undefined, no class unions',
    },
    messages: {
      noUndefined:
        'DTO field "{{ name }}" must not use T | undefined. Use @ApiPropertyOptional() with optional property (?) instead. (conventions.md: Union type rules)',
      noClassUnion:
        'DTO field "{{ name }}" must not use class unions (e.g., UserDto | GuestDto). Consolidate into a shared DTO or use separate fields. (conventions.md: Union type rules)',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        const ann = node.typeAnnotation?.typeAnnotation;
        if (!ann || ann.type !== 'TSUnionType') return;

        const fieldName = node.key?.name ?? node.key?.value ?? 'unknown';

        // Check for T | undefined
        const hasUndefined = ann.types.some(
          (t) => t.type === 'TSUndefinedKeyword',
        );
        if (hasUndefined) {
          context.report({
            node: node.key,
            messageId: 'noUndefined',
            data: { name: fieldName },
          });
          return;
        }

        // Check for class unions (two or more TSTypeReference that are not null)
        const nonNullRefs = ann.types.filter(
          (t) => t.type === 'TSTypeReference',
        );
        if (nonNullRefs.length >= 2) {
          context.report({
            node: node.key,
            messageId: 'noClassUnion',
            data: { name: fieldName },
          });
        }
      },
    };
  },
};

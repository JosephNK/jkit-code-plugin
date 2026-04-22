// =============================================================================
// Rule: dto-union-type-restriction
// -----------------------------------------------------------------------------
// DTO 필드의 유니온 타입 사용 제한.
//
// 금지 케이스:
//   1) T | undefined  → @ApiPropertyOptional() + optional property (foo?: T)로 표현
//      이유: Swagger가 `undefined` 유니온을 올바르게 해석하지 못해 문서 누락 발생.
//            Optional은 `?`가 표준이며, undefined 유니온은 이중 표현으로 혼란.
//
//   2) 클래스 유니온 (UserDto | GuestDto 등)
//      이유: Swagger OpenAPI 스펙상 union/oneOf 표현이 복잡하고,
//            클라이언트 타입 가드 비용이 높다. 공통 DTO로 통합하거나 별도 필드로 분리.
//
// 허용 케이스:
//   - T | null (명시적 null 허용은 DB 컬럼 매핑과 일치)
//   - 원시 타입 유니온 (예: 'admin' | 'user' — string literal enum)
// =============================================================================

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

        // Case 1: T | undefined 금지
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

        // Case 2: 클래스 유니온 금지 (TSTypeReference가 2개 이상)
        // 원시 타입/literal/null은 TSTypeReference가 아니므로 카운트되지 않음
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

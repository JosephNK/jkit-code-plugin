// =============================================================================
// Rule: require-api-property
// -----------------------------------------------------------------------------
// 모든 public DTO 필드에 @ApiProperty 또는 @ApiPropertyOptional 데코레이터 강제.
//
// 이유: Swagger/OpenAPI 문서 완전성 보장.
//   - 데코레이터 누락 시 해당 필드가 Swagger UI에 노출되지 않아 API 계약 문서와
//     실제 응답/요청이 괴리된다.
//   - 외부 클라이언트/프론트엔드가 잘못된 타입으로 통신하면 런타임 에러 + 디버깅 비용 증가.
//
// 검사 대상: public readonly 인스턴스 필드 (static/private/protected 제외)
// 검사 방법: 필드 위 decorator 배열에서 @ApiProperty() 또는 @ApiPropertyOptional() 탐색
// =============================================================================

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
        // static/private/protected 필드는 API 계약과 무관하므로 검사 제외
        if (node.static) return;
        if (node.accessibility === 'private') return;
        if (node.accessibility === 'protected') return;

        // readonly가 아닌 필드는 baseImmutabilityRules에서 이미 에러 처리 — 중복 경고 방지
        if (!node.readonly) return;

        const decorators = node.decorators ?? [];
        const hasApiDecorator = decorators.some((d) => {
          const expr = d.expression;
          // @ApiProperty() 호출 형태와 @ApiProperty 식별자 형태 양쪽 지원
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

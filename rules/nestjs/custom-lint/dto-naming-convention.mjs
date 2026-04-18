// =============================================================================
// Rule: dto-naming-convention
// -----------------------------------------------------------------------------
// DTO 클래스 네이밍 표준화.
//
// 허용 패턴:
//   - *DataResponseDto   : 응답 페이로드의 data 필드 타입 (예: UserDataResponseDto)
//   - *ItemDto           : 리스트 아이템 타입 (예: UserItemDto)
//
// 금지 패턴 (경고):
//   - *ResponseDto       : 모호함 (data 래핑 여부 불명확) → *DataResponseDto 권장
//   - *DataDto           : 모호함 (요청/응답 구분 불명확) → *DataResponseDto 권장
//
// 이유: 일관된 네이밍이 있어야 응답 구조(`{ data: ... }` 래핑)가 코드베이스 전체에서
//       자동 추론 가능해진다. 레거시 혼재를 줄이기 위한 마이그레이션 가드.
// =============================================================================

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

        // 허용 패턴: *DataResponseDto (정식 이름)
        if (name.endsWith('DataResponseDto')) return;

        // 허용 패턴: *ItemDto (리스트 아이템)
        if (name.endsWith('ItemDto')) return;

        // *ResponseDto로 끝나는 경우 — *DataResponseDto/*ItemDto 권장
        if (name.endsWith('ResponseDto')) {
          context.report({
            node: node.id,
            messageId: 'noResponseDto',
            data: { name },
          });
          return;
        }

        // *DataDto로 끝나는 경우 — *DataResponseDto 권장
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

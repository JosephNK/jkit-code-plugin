// =============================================================================
// Rule: dto-naming-convention
// -----------------------------------------------------------------------------
// DTO 클래스 네이밍 표준화 + 파일명-클래스명 짝 검증.
//
// 허용 패턴:
//   - *DataResponseDto   : 응답 페이로드의 data 필드 타입 (예: UserDataResponseDto)
//   - *ItemDto           : 리스트 아이템 / 중첩 객체 타입 (예: UserItemDto)
//
// 금지 패턴:
//   - *ResponseDto       : 모호함 (data 래핑 여부 불명확) → *DataResponseDto 권장
//   - *DataDto           : 모호함 (요청/응답 구분 불명확) → *DataResponseDto 권장
//
// 파일-클래스 짝 검증:
//   - *.response.dto.ts  : 안의 class는 *DataResponseDto 로 끝나야 함
//                          (공용 *ItemDto 선언은 동일 파일에 예외적으로 허용)
//   - *-item.dto.ts      : 안의 class는 *ItemDto 로 끝나야 함
//
// 이유: 파일명으로 역할을 드러내고 class 이름도 그 역할과 일치해야 PR 리뷰에서
//       매번 똑같은 피드백이 반복되지 않는다. 응답 구조(`{ data: ... }`) 래핑
//       여부가 파일 경로만으로 자동 추론 가능해진다.
// =============================================================================

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce DTO naming: use *DataResponseDto or *ItemDto instead of bare *ResponseDto / *DataDto, and match file name to class suffix',
    },
    messages: {
      noResponseDto:
        'Class "{{ name }}" uses bare *ResponseDto suffix. Use *DataResponseDto or *ItemDto instead. (conventions.md: Naming Convention)',
      noDataDto:
        'Class "{{ name }}" uses *DataDto suffix. Use *DataResponseDto instead. (conventions.md: Naming Convention)',
      responseFileSuffix:
        'Class "{{ name }}" in *.response.dto.ts must end with "DataResponseDto" (or "ItemDto" for co-located nested items). (conventions.md: Naming Convention)',
      itemFileSuffix:
        'Class "{{ name }}" in *-item.dto.ts must end with "ItemDto". (conventions.md: Naming Convention)',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    const basename = filename.split('/').pop() ?? '';
    const isResponseFile = basename.endsWith('.response.dto.ts');
    const isItemFile =
      basename.endsWith('-item.dto.ts') || basename.endsWith('.item.dto.ts');

    return {
      ClassDeclaration(node) {
        const name = node.id?.name;
        if (!name) return;

        // 파일-클래스 짝: *.response.dto.ts → *DataResponseDto (같은 파일 내
        // 보조 *ItemDto 선언은 허용)
        if (isResponseFile) {
          if (
            !name.endsWith('DataResponseDto') &&
            !name.endsWith('ItemDto')
          ) {
            context.report({
              node: node.id,
              messageId: 'responseFileSuffix',
              data: { name },
            });
          }
          return;
        }

        // 파일-클래스 짝: *-item.dto.ts → *ItemDto
        if (isItemFile) {
          if (!name.endsWith('ItemDto')) {
            context.report({
              node: node.id,
              messageId: 'itemFileSuffix',
              data: { name },
            });
          }
          return;
        }

        // 그 외 .dto.ts 파일 — 기존 네이밍 가드 유지
        //   허용: *DataResponseDto, *ItemDto
        //   경고: bare *ResponseDto, *DataDto
        if (name.endsWith('DataResponseDto')) return;
        if (name.endsWith('ItemDto')) return;

        if (name.endsWith('ResponseDto')) {
          context.report({
            node: node.id,
            messageId: 'noResponseDto',
            data: { name },
          });
          return;
        }

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

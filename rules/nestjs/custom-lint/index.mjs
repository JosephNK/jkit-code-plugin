// =============================================================================
// JKit NestJS — Custom ESLint Plugin
// -----------------------------------------------------------------------------
// conventions.md의 규칙 중 표준 ESLint 룰로 표현 불가능한 것을 커스텀 룰로 제공.
// 각 룰은 ESLint v8+ 플러그인 인터페이스를 따르며, 이 index에서 집계 export.
//
// 포함 룰:
//   - require-api-property         : DTO 필드에 @ApiProperty 데코레이터 강제
//   - dto-naming-convention        : DTO 네이밍 컨벤션 (ResponseDto → DataResponseDto)
//   - require-timestamptz          : TypeORM Date 컬럼에 timestamptz 타입 강제
//   - require-map-domain-exception : controller catch 블록에서 mapDomainException 호출 강제
//   - dto-union-type-restriction   : DTO 필드에서 유니온 타입 제한
// =============================================================================

import requireApiProperty from './require-api-property.mjs';
import dtoNamingConvention from './dto-naming-convention.mjs';
import requireTimestamptz from './require-timestamptz.mjs';
import requireMapDomainException from './require-map-domain-exception.mjs';
import dtoUnionTypeRestriction from './dto-union-type-restriction.mjs';

/** @type {import('eslint').ESLint.Plugin} */
export default {
  rules: {
    'require-api-property': requireApiProperty,
    'dto-naming-convention': dtoNamingConvention,
    'require-timestamptz': requireTimestamptz,
    'require-map-domain-exception': requireMapDomainException,
    'dto-union-type-restriction': dtoUnionTypeRestriction,
  },
};

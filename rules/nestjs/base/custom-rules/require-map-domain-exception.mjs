// =============================================================================
// Rule: require-map-domain-exception
// -----------------------------------------------------------------------------
// controller의 catch 블록에서 mapDomainException() 호출 강제.
//
// 이유:
//   - 도메인 예외(DomainException)를 그대로 throw하면 NestJS 기본 필터가 500을 반환.
//   - mapDomainException()은 도메인 예외를 적절한 HTTP 예외(NotFoundException 등)로
//     변환하는 프로젝트 공용 헬퍼.
//   - catch에서 변환을 누락하면 클라이언트가 모든 에러를 500으로 받게 되어
//     디버깅 어려움 + UX 저하 + 보안 정보 누출 위험.
//
// 검사: 모든 CatchClause의 body를 재귀 순회하여 mapDomainException 호출 존재 여부 확인.
//       controller/ 파일에만 적용되도록 eslint 설정에서 files 지정 필요.
// =============================================================================

/**
 * 노드 또는 그 자손 중에 mapDomainException 호출이 있는지 재귀 검사.
 */
function containsMapDomainException(node) {
  if (!node || typeof node !== 'object') return false;

  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'mapDomainException'
  ) {
    return true;
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      if (child.some((c) => containsMapDomainException(c))) return true;
    } else if (child && typeof child.type === 'string') {
      if (containsMapDomainException(child)) return true;
    }
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require mapDomainException() in controller catch blocks',
    },
    messages: {
      missingMapper:
        'Controller catch blocks must call mapDomainException(). (conventions.md: Error Handling)',
    },
    schema: [],
  },
  create(context) {
    return {
      CatchClause(node) {
        if (!containsMapDomainException(node.body)) {
          context.report({
            node,
            messageId: 'missingMapper',
          });
        }
      },
    };
  },
};

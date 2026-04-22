// =============================================================================
// Rule: no-entity-return
// -----------------------------------------------------------------------------
// controller/ 및 service/ 레이어 메서드의 반환 타입에서 domain entity 사용 금지.
//
// 이유:
//   - Entity는 DB 스키마와 1:1 매핑. 그대로 API 응답으로 내보내면 내부 컬럼 노출 +
//     API 변경 시 DB 변경이 강제되는 커플링 발생.
//   - Response DTO로 변환하는 것이 API 계약 분리의 핵심.
//
// 검사 범위:
//   - `src/modules/**/controller/**/*.controller.ts`
//   - `src/modules/**/service/**/*.service.ts`
//
// 검사 방법:
//   - 파일 상단 import문에서 `*.entity` 또는 `*/model/*.entity`로부터 가져온 심볼을 수집
//   - 함수/메서드/화살표 함수의 return type annotation에서 위 심볼 참조 시 리포트
//   - Promise<Entity>, Entity[], readonly Entity[] 등 일반적 wrapper도 내부 참조를 검사
//
// 한계:
//   - 명시적 return type annotation이 없는 메서드는 검사되지 않는다
//     (TS inference는 rule context 밖 — type-checker 없이 검사 불가).
//   - 따라서 본 룰은 "의도적으로 entity를 노출한 경우"만 잡는다.
//     Annotation 강제는 별도 룰/컨벤션으로 보강.
// =============================================================================

/**
 * import source가 entity 파일인지 판단.
 * "*.entity" 또는 경로에 `/model/` 이 포함된 모든 경우를 대상으로 한다.
 */
function isEntitySource(source) {
  if (typeof source !== 'string') return false;
  // 확장자가 생략된 경우가 대부분 — `.entity`로 끝나거나 `.entity.ts`로 끝남
  if (/\.entity(\.ts)?$/.test(source)) return true;
  // TypeORM orm-entity도 DB 스키마이므로 동일하게 노출 금지 대상
  if (/\.orm-entity(\.ts)?$/.test(source)) return true;
  return false;
}

/**
 * 타입 노드를 재귀 순회하며 entity 심볼 참조를 찾는다.
 * Promise<T>, T[], readonly T[], T | null 등 일반 wrapper를 모두 내려가며 검사.
 */
function findEntityReference(typeNode, entityNames) {
  if (!typeNode || typeof typeNode !== 'object') return null;

  switch (typeNode.type) {
    case 'TSTypeReference': {
      const name = typeNode.typeName?.name;
      if (name && entityNames.has(name)) return name;
      // Promise<T>, Array<T>, ReadonlyArray<T> 등
      const params = typeNode.typeArguments?.params ?? typeNode.typeParameters?.params ?? [];
      for (const p of params) {
        const hit = findEntityReference(p, entityNames);
        if (hit) return hit;
      }
      return null;
    }
    case 'TSArrayType':
      return findEntityReference(typeNode.elementType, entityNames);
    case 'TSUnionType':
    case 'TSIntersectionType':
      for (const t of typeNode.types) {
        const hit = findEntityReference(t, entityNames);
        if (hit) return hit;
      }
      return null;
    case 'TSTypeOperator': // readonly T[]
      return findEntityReference(typeNode.typeAnnotation, entityNames);
    case 'TSParenthesizedType':
      return findEntityReference(typeNode.typeAnnotation, entityNames);
    default:
      return null;
  }
}

const TARGET_PATTERN = /\/src\/modules\/[^/]+(?:\/[^/]+)*\/(controller|service)\/[^/]*\.(controller|service)\.ts$/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow returning domain entities from controller/ or service/ methods',
    },
    messages: {
      noEntityReturn:
        'Return type references entity "{{ name }}". Transform through a ResponseDto. (conventions.md: Response DTO Patterns)',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    if (!filename.match(TARGET_PATTERN)) {
      return {};
    }

    const entityNames = new Set();

    const checkReturnType = (fn) => {
      const returnType = fn?.returnType?.typeAnnotation;
      if (!returnType) return;
      const hit = findEntityReference(returnType, entityNames);
      if (hit) {
        context.report({
          node: returnType,
          messageId: 'noEntityReturn',
          data: { name: hit },
        });
      }
    };

    return {
      ImportDeclaration(node) {
        if (!isEntitySource(node.source.value)) return;
        for (const spec of node.specifiers) {
          if (spec.local?.name) entityNames.add(spec.local.name);
        }
      },

      FunctionDeclaration(node) {
        checkReturnType(node);
      },
      FunctionExpression(node) {
        checkReturnType(node);
      },
      ArrowFunctionExpression(node) {
        checkReturnType(node);
      },
      // class method/getter
      MethodDefinition(node) {
        checkReturnType(node.value);
      },
      // class field assigned arrow function: `foo = (): Entity => ...`
      PropertyDefinition(node) {
        if (node.value && node.value.type === 'ArrowFunctionExpression') {
          checkReturnType(node.value);
        }
      },
    };
  },
};

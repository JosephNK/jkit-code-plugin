/**
 * Recursively check if a node or its descendants contain
 * a call to `mapDomainException`.
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

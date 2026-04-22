// =============================================================================
// Rule: no-tailwindcss-css
// -----------------------------------------------------------------------------
// Tailwind CSS import 전역 차단.
// UI 라이브러리 무관한 프로젝트 정책이므로 단독 룰로 존재.
//
// 이유:
// - 컴포넌트 기반 디자인 시스템과 utility CSS는 토큰 시스템이 이중화되어
//   번들 크기 증가 + 테마 관리 분산을 유발한다.
// - 스타일 전략을 "UI lib style props → style prop → CSS Modules" 한 줄기로
//   단일화해야 유지보수성이 확보된다.
//
// CSS-in-JS 차단은 UI lib마다 다른 결정 사항이므로 여기서는 다루지 않는다
// (각 UI lib 스택의 책임).
//
// 검사 대상: `import ... from 'tailwindcss'`, `import ... from 'tailwindcss/...'`
// =============================================================================

const BANNED_PATTERN = /^tailwindcss(\/.*)?$/;
const MESSAGE =
  "Tailwind CSS is not allowed. Use the project UI library style props or CSS Modules.";

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing tailwindcss",
    },
    messages: {
      banned: MESSAGE,
    },
    schema: [],
  },
  create(context) {
    function check(node, source) {
      if (typeof source !== "string") return;
      if (BANNED_PATTERN.test(source)) {
        context.report({ node, messageId: "banned" });
      }
    }
    return {
      ImportDeclaration(node) {
        check(node, node.source?.value);
      },
      // `import('tailwindcss')`
      ImportExpression(node) {
        if (node.source?.type === "Literal") {
          check(node, node.source.value);
        }
      },
      // `require('tailwindcss')`
      CallExpression(node) {
        if (
          node.callee?.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments?.[0]?.type === "Literal"
        ) {
          check(node, node.arguments[0].value);
        }
      },
    };
  },
};

// =============================================================================
// Rule: no-unknown-domain-folder
// -----------------------------------------------------------------------------
// `<domain>/` 직속 하위 폴더는 다음만 허용:
//   model, port, service, controller, strategy, provider, dto, exception, common
//
// 허용 구조:
//   src/modules/<domain>/<layer>/...           ✅
//   src/modules/<group>/<domain>/<layer>/...   ✅
//
// 위반 예:
//   src/modules/oauth/modules/email/service/x.service.ts  ❌ (modules가 알 수 없는 폴더)
//   src/modules/order/utils/helper.ts                     ❌ (utils — boundaries/no-unknown-files도 잡지만 명시 메시지 제공)
//
// 보완 룰:
//   - no-nested-layer-dir: 레이어 폴더 *내부*에 하위 폴더 금지
//   - boundaries/no-unknown-files: 어떤 element pattern에도 안 맞는 파일 차단
//
// 제외 대상:
//   - *.spec.ts / *.test.ts / *.module.ts (테스트·DI 조립)
// =============================================================================

const LAYERS = [
  "model",
  "port",
  "service",
  "controller",
  "strategy",
  "provider",
  "exception",
  "dto",
  "common",
];

const PATH_PREFIX = "/src/modules/";

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Only model/port/service/controller/strategy/provider/dto/exception/common folders are allowed under <domain>/",
    },
    messages: {
      unknownFolder:
        'Unknown folder under <domain>/ in path "{{ path }}". Only model, port, service, controller, strategy, provider, dto, exception, common are allowed directly under <domain>/. (conventions.md: domain layout)',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename ?? context.getFilename?.() ?? "";
        if (!filename) return;

        const basename = filename.split("/").pop() ?? "";
        if (
          basename.endsWith(".spec.ts") ||
          basename.endsWith(".test.ts") ||
          basename.endsWith(".module.ts")
        ) {
          return;
        }

        const idx = filename.indexOf(PATH_PREFIX);
        if (idx === -1) return;

        const rest = filename.slice(idx + PATH_PREFIX.length);
        const allSegments = rest.split("/");
        if (allSegments.length < 2) return;

        const dirSegments = allSegments.slice(0, -1);

        const layerIdx = dirSegments.findIndex((s) => LAYERS.includes(s));
        if (layerIdx === -1) {
          // 레이어 폴더 자체가 없는 케이스는 boundaries/no-unknown-files가 처리
          return;
        }

        // layerIdx === 1: src/modules/<domain>/<layer>/... ✅
        // layerIdx === 2: src/modules/<group>/<domain>/<layer>/... ✅
        // 그 외: <domain>/ 직속이 아닌 위치에 layer가 있음 → 사이에 unknown 폴더 존재
        if (layerIdx === 1 || layerIdx === 2) return;

        // layerIdx === 0: src/modules/<layer>/... — domain 자체가 없음
        // layerIdx >= 3: src/modules/<group>/<domain>/<unknown>/.../<layer>
        const violatingPath = `src/modules/${dirSegments
          .slice(0, layerIdx + 1)
          .join("/")}/`;

        context.report({
          node,
          messageId: "unknownFolder",
          data: { path: violatingPath },
        });
      },
    };
  },
};

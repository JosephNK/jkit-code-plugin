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
// 검사 방식 (두 단계):
//   1) 경로 검사 — lint 대상 파일 경로 자체가 위 구조를 벗어나면 즉시 보고
//      (예: src/modules/oauth/modules/email/service/x.service.ts)
//   2) 디렉토리 스캔 — 도메인을 찾으면 fs.readdirSync로 직속 하위 폴더 전체를
//      훑어 화이트리스트 외 폴더가 있으면 보고. 빈 폴더 / `.ts` 없는 폴더도
//      잡을 수 있게 anchor에 `<domain>.module.ts`도 포함한다.
//
// 보완 룰:
//   - no-nested-layer-dir: 레이어 폴더 *내부*에 하위 폴더 금지
//   - boundaries/no-unknown-files: 어떤 element pattern에도 안 맞는 파일 차단
//
// 제외 대상:
//   - *.spec.ts / *.test.ts (테스트 파일은 anchor에서 제외)
//   - *.module.ts는 *anchor로 사용*해 스캔을 트리거 (이 룰만의 예외)
// =============================================================================

import fs from "node:fs";

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

// 같은 unknown 폴더가 여러 파일에서 중복 보고되는 것을 방지 (모듈 레벨 캐시).
// 키는 디스크 절대 경로 — 폴더가 삭제되면 readdirSync에서 더 이상 안 나오므로
// stale 캐시도 false-positive를 만들지 않는다.
const reportedUnknownFolders = new Set();

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
        'Unknown folder under <domain>/ at "{{ path }}". Only model, port, service, controller, strategy, provider, dto, exception, common are allowed directly under <domain>/. (conventions.md: domain layout)',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename ?? context.getFilename?.() ?? "";
        if (!filename) return;

        const basename = filename.split("/").pop() ?? "";
        if (basename.endsWith(".spec.ts") || basename.endsWith(".test.ts")) {
          return;
        }

        const idx = filename.indexOf(PATH_PREFIX);
        if (idx === -1) return;

        const rest = filename.slice(idx + PATH_PREFIX.length);
        const allSegments = rest.split("/");
        if (allSegments.length < 2) return;

        const dirSegments = allSegments.slice(0, -1);
        const isModuleFile = basename.endsWith(".module.ts");

        // domainSegments: src/modules/ 이후 도메인까지의 segment 목록
        // 정상: [<domain>] 또는 [<group>, <domain>]
        let domainSegments = null;

        if (isModuleFile) {
          if (dirSegments.length === 1 || dirSegments.length === 2) {
            domainSegments = dirSegments;
          } else {
            // module.ts가 비정상 깊이 — 경로 자체로 보고 후 스캔 생략
            const violatingPath = `src/modules/${dirSegments.join("/")}/`;
            context.report({
              node,
              messageId: "unknownFolder",
              data: { path: violatingPath },
            });
            return;
          }
        } else {
          const layerIdx = dirSegments.findIndex((s) => LAYERS.includes(s));
          if (layerIdx === -1) {
            // 레이어 폴더가 경로에 없음 — boundaries/no-unknown-files가 처리
            return;
          }
          if (layerIdx === 1 || layerIdx === 2) {
            domainSegments = dirSegments.slice(0, layerIdx);
          } else {
            // 깊은 nesting — 경로 자체로 보고 후 스캔 생략
            const violatingPath = `src/modules/${dirSegments.slice(0, layerIdx + 1).join("/")}/`;
            context.report({
              node,
              messageId: "unknownFolder",
              data: { path: violatingPath },
            });
            return;
          }
        }

        // 도메인 폴더 디스크 경로 → readdir로 직속 하위 디렉토리 전수 검사
        const prefix = filename.slice(0, idx + PATH_PREFIX.length);
        const domainAbsPath = prefix + domainSegments.join("/");

        let entries;
        try {
          entries = fs.readdirSync(domainAbsPath, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (LAYERS.includes(entry.name)) continue;

          const unknownAbsPath = `${domainAbsPath}/${entry.name}`;
          if (reportedUnknownFolders.has(unknownAbsPath)) continue;
          reportedUnknownFolders.add(unknownAbsPath);

          const violatingPath = `src/modules/${domainSegments.join("/")}/${entry.name}/`;
          context.report({
            node,
            messageId: "unknownFolder",
            data: { path: violatingPath },
          });
        }
      },
    };
  },
};

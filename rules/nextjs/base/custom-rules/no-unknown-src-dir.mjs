// =============================================================================
// Rule: no-unknown-src-dir
// -----------------------------------------------------------------------------
// `src/` 직속 디렉토리를 화이트리스트로 제한한다.
//
// 허용:
//   src/app, src/components, src/domain, src/http, src/hooks, src/lib,
//   src/db, src/email-templates, src/i18n
//
// 위반 예:
//   src/utils/...     ❌ (utils/ 디렉토리)
//   src/types/...     ❌ (types/ 디렉토리)
//
// 정상 예:
//   src/app/...       ✅
//   src/components/.. ✅
//   src/domain/...    ✅
//   src/http/...      ✅
//   src/hooks/...     ✅
//   src/lib/...       ✅
//   src/db/...        ✅
//   src/email-templates/... ✅
//   src/i18n/...      ✅ (next-intl 런타임 설정 + 로케일 사전)
//
// 적용 범위:
//   src/<dir>/        — 화이트리스트 외 디렉토리 차단
//
// 비고:
//   - 파일 직속(예: `src/middleware.ts`)은 차단 대상이 아니다.
//   - boundary `no-unknown-files`는 파일 단위 매칭만 보장하므로 빈 폴더나
//     boundary element pattern에 매치되지 않는 파일만 있는 폴더는 우회된다.
//     본 룰은 sibling 파일이 lint될 때 src/ 직속을 readdirSync로 스캔해 보강한다.
// =============================================================================

import fs from "node:fs";

const ALLOWED_SRC_DIRS = new Set([
  "app",
  "components",
  "domain",
  "http",
  "hooks",
  "lib",
  "db",
  "email-templates",
  "i18n",
]);

const SRC_MARKER = "/src/";

const reportedDirs = new Set();

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow only whitelisted directories directly under src/ (app, components, domain, http, hooks, lib, db, email-templates, i18n)",
    },
    messages: {
      unknownDir:
        '"src/{{ subdir }}/" is not allowed. Only these top-level folders are permitted under src/: app, components, domain, http, hooks, lib, db, email-templates, i18n.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename ?? context.getFilename?.() ?? "";
        if (!filename) return;

        const idx = filename.indexOf(SRC_MARKER);
        if (idx === -1) return;

        const srcAbsPath = filename.slice(0, idx + SRC_MARKER.length - 1);

        let entries;
        try {
          entries = fs.readdirSync(srcAbsPath, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (ALLOWED_SRC_DIRS.has(entry.name)) continue;

          const dirAbsPath = `${srcAbsPath}/${entry.name}`;
          if (reportedDirs.has(dirAbsPath)) continue;
          reportedDirs.add(dirAbsPath);

          context.report({
            node,
            messageId: "unknownDir",
            data: {
              subdir: entry.name,
            },
          });
        }
      },
    };
  },
};

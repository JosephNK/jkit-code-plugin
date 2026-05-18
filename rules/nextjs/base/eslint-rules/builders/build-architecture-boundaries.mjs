import { defineConfig } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";

import { baseBoundaryIgnores } from "../boundaries/boundary-ignores.mjs";
import { baseImportResolverSettings } from "../settings/import-resolver-settings.mjs";

/**
 * boundaries 플러그인 룰 생성기. elements ↔ rules 매핑으로
 * from→to 의존을 allow-list 검사 (default: disallow).
 */
export function buildArchitectureBoundaries(
  elements,
  rules,
  ignores = baseBoundaryIgnores,
) {
  return defineConfig([
    {
      plugins: { boundaries },
      settings: {
        ...baseImportResolverSettings,
        "boundaries/elements": elements,
        "boundaries/ignore": ignores,
      },
      rules: {
        "boundaries/no-unknown": "error",
        "boundaries/no-unknown-files": "error",
        "boundaries/dependencies": [
          "error",
          {
            default: "disallow",
            rules,
          },
        ],
      },
    },
  ]);
}

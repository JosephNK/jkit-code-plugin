/**
 * 상대 경로 parent import(../**) 금지 — `@/*` path alias 사용 강제.
 * buildLayerRestrictions에서 각 레이어의 no-restricted-imports에 주입.
 */
export const basePathAliasPattern = {
  group: ["../**"],
  message: "Use @/* path alias instead of relative parent imports.",
};

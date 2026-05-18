/**
 * 전역 no-restricted-imports 패턴. 깊은 상대경로(`../../**`) 금지로 폴더 구조
 * 리팩토링 시 import 파손 방지 + `@/*` path alias 사용 강제.
 * 더불어 deprecated 경로(`@/lib/dictionaries/**`)를 `@/i18n/**`로 이동시키도록 차단.
 */
export const baseRestrictedPatterns = [
  {
    group: ["../../**"],
    message: "Use @/* path alias instead of deep relative parent imports.",
  },
  {
    group: ["@/lib/dictionaries/*", "@/lib/dictionaries/**"],
    message:
      "Move i18n to src/i18n/: dictionaries → @/i18n/dictionaries/*, routing/request/navigation → @/i18n/*.",
  },
];

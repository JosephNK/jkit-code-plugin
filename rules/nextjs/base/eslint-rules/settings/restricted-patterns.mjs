/**
 * 전역 no-restricted-imports 패턴. 깊은 상대경로(`../../**`) 금지로 폴더 구조
 * 리팩토링 시 import 파손 방지 + `@/*` path alias 사용 강제.
 */
export const baseRestrictedPatterns = [
  {
    group: ["../../**"],
    message: "Use @/* path alias instead of deep relative parent imports.",
  },
];

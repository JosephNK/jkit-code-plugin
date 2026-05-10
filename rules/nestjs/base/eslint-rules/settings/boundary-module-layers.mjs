/**
 * `src/modules/<domain>/<layer>/` 위치에 들어가는 layer SSOT.
 * boundary-elements는 spread로 인용하고, 두 커스텀 룰
 * (`no-unknown-domain-folder`, `no-nested-layer-dir`)은 `.map(x => x.type)`
 * 으로 layer name 집합을 추출한다.
 *
 * 새 layer 추가 시:
 *   1) 이 배열에 `{ type, pattern, // 설명 }` 추가
 *   2) `boundary-rules.mjs`에 from/to 정책 추가
 *   3) layer-semantics.mjs에 Role/Contains/Example 추가
 */
export const MODULE_LAYERS = [
  { type: "model", pattern: ["src/modules/**/model/**"] }, // 도메인 모델
  { type: "port", pattern: ["src/modules/**/port/**"] }, // 도메인 Port 인터페이스
  { type: "service", pattern: ["src/modules/**/service/**"] }, // UseCase
  { type: "controller", pattern: ["src/modules/**/controller/**"] }, // HTTP 컨트롤러
  { type: "strategy", pattern: ["src/modules/**/strategy/**"] }, // Inbound 어댑터 (Passport 등 인증 전략) 또는 가변 알고리즘
  { type: "provider", pattern: ["src/modules/**/provider/**"] }, // Port 구현체
  { type: "exception", pattern: ["src/modules/**/exception/**"] }, // 도메인 예외
  { type: "dto", pattern: ["src/modules/**/dto/**"] }, // 요청/응답 DTO
];

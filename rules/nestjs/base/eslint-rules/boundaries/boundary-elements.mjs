/**
 * 아키텍처 경계 — 각 레이어 type ↔ 경로 매핑.
 * 레이어별 책임·파일 종류는 `baseLayerSemantics` 참조.
 */
export const baseBoundaryElements = [
  { type: "model", pattern: ["src/modules/**/model/**"] }, // 도메인 모델
  { type: "port", pattern: ["src/modules/**/port/**"] }, // 도메인 Port 인터페이스
  { type: "service", pattern: ["src/modules/**/service/**"] }, // UseCase
  { type: "controller", pattern: ["src/modules/**/controller/**"] }, // HTTP 컨트롤러
  { type: "strategy", pattern: ["src/modules/**/strategy/**"] }, // Inbound 어댑터 (Passport 등 인증 전략) 또는 가변 알고리즘
  { type: "provider", pattern: ["src/modules/**/provider/**"] }, // Port 구현체
  { type: "exception", pattern: ["src/modules/**/exception/**"] }, // 도메인 예외
  { type: "dto", pattern: ["src/modules/**/dto/**"] }, // 요청/응답 DTO
  // common/infrastructure는 허용 하위 폴더만 명시 — no-unknown-files가 그 외 경로를 거부
  // common-pure를 별도 element로 분리 — framework-free 폴더만 묶어 model 포함 모든 레이어에서 import 허용
  // 새 pure 폴더(utils/events/interfaces 등) 추가 시 pattern 배열에 append만
  { type: "common-pure", pattern: ["src/common/constants/**"] },
  {
    type: "common",
    pattern: [
      "src/common/authentication/**",
      "src/common/guards/**",
      "src/common/exceptions/**",
      "src/common/interfaces/**",
      "src/common/middlewares/**",
      "src/common/pipes/**",
      "src/common/interceptors/**",
      "src/common/decorators/**",
      "src/common/events/**",
      "src/common/dtos/**",
      "src/common/config/**",
      "src/common/utils/**",
    ],
  }, // 전역 공용 (허용 하위 폴더만)
  {
    type: "infrastructure",
    pattern: [
      "src/infrastructure/database/**",
      "src/infrastructure/i18n/**",
      "src/infrastructure/logger/**",
      "src/infrastructure/cache/**",
      "src/infrastructure/email/**",
      "src/infrastructure/transaction/**",
      "src/infrastructure/external/**",
    ],
  }, // 인프라 수평 관심사 (허용 하위 폴더만)
  { type: "libs", pattern: ["src/libs/**"] }, // 독립 라이브러리
];

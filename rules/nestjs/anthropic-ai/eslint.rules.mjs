// =============================================================================
// JKit NestJS — Anthropic AI SDK 스택 규칙
// -----------------------------------------------------------------------------
// Anthropic SDK(@anthropic-ai/*)는 LLM 호출 인프라로, 도메인/UseCase가 특정
// AI 제공자에 결합되지 않도록 Port 뒤로 격리한다. (OpenAI 등 타 제공자로 교체 시
// provider 구현체 교체만으로 대응 가능해야 함)
// =============================================================================

/**
 * Framework 목록 → model/, port/, exception/ 차단.
 * 도메인 타입에 Anthropic 응답 구조가 노출되지 않도록.
 */
export const anthropicFrameworkPackages = [
  '@anthropic-ai/*',
];

/**
 * Infra 목록 → service/ 직접 사용 차단.
 * LLM 호출은 provider/ 에서 Port 구현체로 캡슐화.
 */
export const anthropicInfraPackages = [
  '@anthropic-ai/*',
];

// =============================================================================
// JKit NestJS — Google Cloud (GCP) 스택 규칙
// -----------------------------------------------------------------------------
// GCP SDK(@google-cloud/*)는 vendor-lock 강도가 높아 service 계층에서 직접
// 사용하면 추후 AWS/Azure 이관 시 리팩토링 범위가 모듈 전체로 번진다.
// Port 추상화 뒤로 격리하기 위해 두 목록 모두 차단한다.
// =============================================================================

/**
 * Framework 목록에 포함 → model/, port/, exception/ 에서 차단.
 * 도메인 계층이 특정 클라우드 벤더에 의존하는 상황 방지.
 */
export const gcpFrameworkPackages = [
  '@google-cloud/*',
];

/**
 * Infra 목록에 포함 → service/ 에서도 직접 import 차단.
 * GCP SDK는 provider/ 계층에서 Port 구현체로만 호출한다.
 */
export const gcpInfraPackages = [
  '@google-cloud/*',
];

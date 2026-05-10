/**
 * 아키텍처 경계 — 각 레이어 type ↔ 경로 매핑.
 * `mode: 'full'`은 단일 파일 정확 매칭. 레이어 책임은 `baseLayerSemantics` 참조.
 */
export const baseBoundaryElements = [
  // Domain layer — 프레임워크 비의존 순수 TS
  { type: 'domain-model', pattern: ['src/lib/domain/models'] },       // 엔티티/값 객체
  { type: 'domain-error', pattern: ['src/lib/domain/errors'] },       // 도메인 에러 타입
  { type: 'domain-port', pattern: ['src/lib/domain/ports'] },         // Repository 인터페이스
  { type: 'domain-service', pattern: ['src/lib/domain/services'] },   // UseCase/서비스
  // API adapter layer — 외부 시스템 연동
  { type: 'api-client', mode: 'full', pattern: ['src/lib/api/client.ts'] },      // HTTP 클라이언트 단일 파일
  { type: 'api-endpoint', mode: 'full', pattern: ['src/lib/api/endpoints.ts'] }, // 엔드포인트 URL 상수
  { type: 'api-dto', mode: 'full', pattern: ['src/lib/api/types.ts'] },          // 외부 API 응답 타입
  { type: 'api-mapper', pattern: ['src/lib/api/mappers'] },                      // DTO ↔ Domain 변환
  { type: 'api-repository', pattern: ['src/lib/api/repositories'] },             // Port 구현체
  { type: 'api-hook', pattern: ['src/lib/api/hooks'] },                          // React Query 훅 등
  // Shared lib — src/lib 루트의 공용 유틸
  { type: 'lib-shared', mode: 'full', pattern: ['src/lib/*.ts'] },               // src/lib 루트 공용 유틸
  // DB driver wrapper — 클라이언트 초기화·커넥션 풀·트랜잭션 관리 등 DB 인프라 전담
  // (MongoDB/PostgreSQL/Redis/TypeORM 등 드라이버 무관. 실제 드라이버 선택은 프로젝트 재량)
  { type: 'db', pattern: ['src/lib/db'] },                                       // DB 드라이버 래퍼
  // UI layer
  { type: 'shared-ui', pattern: ['src/components'] },                            // 전역 재사용 컴포넌트
  { type: 'page-component', pattern: ['src/app/\\[locale\\]/**/_components'] }, // 페이지 전용 컴포넌트 ([locale] 아래)
  { type: 'page-provider', pattern: ['src/app/\\[locale\\]/**/_providers'] },   // 페이지 전용 Provider ([locale] 아래)
  // Common — 전역 공용 리소스
  { type: 'dictionary', mode: 'full', pattern: ['src/common/dictionaries/*', 'src/app/\\[locale\\]/dictionaries.ts'] }, // i18n
  { type: 'shared-type', pattern: ['src/common/types'] },                        // 전역 타입
  // Server-rendered templates — 이메일 전송 시 서버에서 렌더링되는 템플릿 전용 공간
  { type: 'email-template', pattern: ['src/lib/email-templates'] },              // React Email 등 이메일 템플릿
  // Route Handler — Next.js App Router HTTP 엔드포인트 (GET/POST 등 export)
  { type: 'route-handler', mode: 'full', pattern: ['src/app/**/route.ts'] },     // API 진입점 (얇은 HTTP 어댑터)
  // Page (catch-all) — 위 패턴에 매칭 안 된 src/app 전부
  { type: 'page', pattern: ['src/app'] },                                        // 최상위 페이지 catch-all
];

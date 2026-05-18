/**
 * 레이어 간 import 관계 (allow-list). 기본 disallow 정책 위에 아래 조합만 허용.
 * 각 레이어의 역할·책임은 "레이어 글로서리" 섹션 참조.
 */
export const baseBoundaryRules = [
  // Domain: 자기 자신 및 하위 순수 레이어만 참조
  { from: { type: "domain-model" }, allow: [{ to: { type: "domain-model" } }] }, // 모델 간 참조만
  { from: { type: "domain-error" }, allow: [{ to: { type: "domain-error" } }] }, // 에러 간 참조만
  { from: { type: "domain-port" }, allow: [{ to: { type: "domain-model" } }] }, // Port 시그니처는 모델을 사용
  {
    from: { type: "domain-service" },
    allow: [
      { to: { type: "domain-model" } },
      { to: { type: "domain-port" } }, // DI로 Port를 주입받음
      { to: { type: "domain-error" } },
      { to: { type: "domain-service" } },
    ],
  },
  // HTTP 원시 계층: 외부에서만 주입받아 쓰므로 import 0개 (순수 데이터/통신 경계)
  { from: { type: "http-client" }, allow: [] },
  { from: { type: "http-endpoint" }, allow: [] },
  { from: { type: "http-dto" }, allow: [] },
  {
    // Mapper: DTO → Domain 변환 전용. 두 타입 모두 참조 필요
    from: { type: "http-mapper" },
    allow: [{ to: { type: "domain-model" } }, { to: { type: "http-dto" } }],
  },
  {
    // Repository: Port 구현체. 모든 원시 통신 요소 + domain 사용.
    // db는 DB 드라이버 래퍼(MongoDB/PostgreSQL/Redis/TypeORM 등 드라이버 무관) — Repository는 실제 DB 호출을 담당하므로 허용.
    from: { type: "http-repository" },
    allow: [
      { to: { type: "http-client" } },
      { to: { type: "http-endpoint" } },
      { to: { type: "http-dto" } }, // type-safe `client.get<UserDto>(...)` 호출용
      { to: { type: "http-mapper" } },
      { to: { type: "domain-port" } },
      { to: { type: "domain-error" } },
      { to: { type: "domain-model" } },
      { to: { type: "db" } },
    ],
  },
  // Hook: UI에 제공되는 데이터 페칭 훅. UseCase(domain-service)만 호출 (Repository 직접 호출 금지)
  { from: { type: "http-hook" }, allow: [{ to: { type: "domain-service" } }] },
  // lib-shared: src/lib 루트 공용 유틸. 내부 의존 0개 (순수 유틸만)
  { from: { type: "lib-shared" }, allow: [] },
  // lib-shared-barrel: re-export 전용 (`src/lib/utils/index.ts`). barrel → leaf만 허용.
  // 다른 레이어에서 `@/lib/utils`로 한 번에 import할 수 있게 하되, utility 간 cross-import는 base의 lib-shared 규칙으로 여전히 차단.
  {
    from: { type: "lib-shared-barrel" },
    allow: [{ to: { type: "lib-shared" } }],
  },
  // db: DB 드라이버 래퍼 — 프로젝트 내 어떤 element도 import 하지 않는다 (순수 래퍼).
  // mongodb/pg/redis/typeorm 등 외부 드라이버 패키지는 element 규칙 대상 아님 → allow: [] 로 충분.
  { from: { type: "db" }, allow: [] },
  {
    // 전역 재사용 UI: 도메인 모델은 타입 표현용으로만 참조. API 호출 금지 (domain-service 접근 불가)
    from: { type: "shared-ui" },
    allow: [
      { to: { type: "domain-model" } },
      { to: { type: "shared-ui" } },
      { to: { type: "shared-type" } },
    ],
  },
  {
    // 페이지 전용 컴포넌트: hook으로 데이터 조회 + UI 조합 + 공용 유틸 사용
    from: { type: "page-component" },
    allow: [
      { to: { type: "http-hook" } },
      { to: { type: "shared-ui" } },
      { to: { type: "domain-model" } },
      { to: { type: "page-component" } },
      { to: { type: "lib-shared" } },
      { to: { type: "lib-shared-barrel" } },
      { to: { type: "shared-type" } },
    ],
  },
  {
    // 페이지 Provider: 설정/컨텍스트 래퍼. 공용 유틸만
    from: { type: "page-provider" },
    allow: [
      { to: { type: "lib-shared" } },
      { to: { type: "lib-shared-barrel" } },
    ],
  },
  {
    // i18n 사전: 타입과 다른 사전 참조만 허용
    from: { type: "dictionary" },
    allow: [{ to: { type: "shared-type" } }, { to: { type: "dictionary" } }],
  },
  // 전역 타입: i18n 키 타입 조회를 위해 dictionary 참조 허용
  { from: { type: "shared-type" }, allow: [{ to: { type: "dictionary" } }] },
  {
    // 이메일 템플릿: i18n 사전과 공통 타입만 접근 가능.
    // 도메인/HTTP 레이어를 직접 import하면 서버 전용 로직이 이메일 렌더 경로로 새게 된다.
    // 필요한 데이터는 호출자(route-handler 등)가 props로 주입해야 한다.
    from: { type: "email-template" },
    allow: [{ to: { type: "dictionary" } }, { to: { type: "shared-type" } }],
  },
  {
    // Route Handler (HTTP 진입점): 얇은 어댑터 — 도메인 서비스 호출에 집중.
    // UI 레이어(shared-ui/page-component) import 금지 (서버 코드 경계 위반).
    from: { type: "route-handler" },
    allow: [
      { to: { type: "domain-model" } },
      { to: { type: "domain-error" } },
      { to: { type: "domain-service" } },
      { to: { type: "shared-type" } },
    ],
  },
  {
    // Page (최상위 컨슈머): 페이지 조립에 필요한 거의 모든 레이어 사용 가능
    // (단, domain-service/repository/http-hook 직접 호출 금지 — 컴포넌트를 거쳐야 함)
    from: { type: "page" },
    allow: [
      { to: { type: "page-component" } },
      { to: { type: "page-provider" } },
      { to: { type: "shared-ui" } },
      { to: { type: "dictionary" } },
      { to: { type: "shared-type" } },
      { to: { type: "page" } },
    ],
  },
];

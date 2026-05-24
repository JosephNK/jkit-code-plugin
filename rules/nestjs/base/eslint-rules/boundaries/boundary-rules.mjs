/**
 * 레이어 간 import 관계 (allow-list). 기본 disallow 정책 위에 아래 조합만 허용.
 * 각 레이어의 역할·책임은 "레이어 글로서리" 섹션 참조.
 */
export const baseBoundaryRules = [
  // model — 자기 자신 + common-pure만 (순수 TS 유지, framework-coupled common 차단)
  // common-pure 확장으로 utils/events 등을 풀고 싶으면 element pattern에 폴더 append
  {
    from: { type: "model" },
    allow: { to: { type: ["model", "common-pure"] } },
  },
  // exception — common의 베이스 예외를 상속하여 정의
  {
    from: { type: "exception" },
    allow: { to: { type: ["exception", "common", "common-pure"] } },
  },
  // port — 인터페이스 시그니처에 model과 공용 타입만 사용
  {
    from: { type: "port" },
    allow: { to: { type: ["model", "common", "common-pure"] } },
  },
  // service — UseCase. port를 주입받아 도메인 로직 수행
  // controller/provider/dto는 의도적으로 제외 (헥사고날 역방향 의존 방지)
  {
    from: { type: "service" },
    allow: {
      to: {
        type: [
          "model",
          "port",
          "exception",
          "common",
          "common-pure",
          "infrastructure",
        ],
      },
    },
  },
  // controller — HTTP 경계. port/dto 조합으로 요청 처리
  // service를 직접 import하지 않고 port를 통해 사용 (DI 컨테이너가 service 바인딩)
  {
    from: { type: "controller" },
    allow: {
      to: {
        type: [
          "port",
          "dto",
          "model",
          "exception",
          "common",
          "common-pure",
          "libs",
        ],
      },
    },
  },
  // strategy — Inbound 어댑터 변종 (Passport/알고리즘). controller와 동일한 import 정책
  {
    from: { type: "strategy" },
    allow: {
      to: {
        type: [
          "port",
          "dto",
          "model",
          "exception",
          "common",
          "common-pure",
          "libs",
        ],
      },
    },
  },
  // provider — Port 구현체. ORM 엔티티 간 상호 참조로 provider→provider 허용
  // libs는 외부 SDK/유틸 wrapper로, provider 구현 시 직접 호출 허용
  {
    from: { type: "provider" },
    allow: {
      to: {
        type: [
          "port",
          "model",
          "common",
          "common-pure",
          "infrastructure",
          "provider",
          "libs",
        ],
      },
    },
  },
  // dto — 내부 composition용 dto→dto 허용 (PartialType, PickType 등)
  {
    from: { type: "dto" },
    allow: { to: { type: ["model", "common", "common-pure", "dto"] } },
  },
  // (*.module.ts) — DI 조립 파일. boundaries/ignore에서 제외 처리됨
  // common — 자기 자신 + common-pure (전역 공용은 최하위라 상향 의존 금지)
  {
    from: { type: "common" },
    allow: { to: { type: ["common", "common-pure"] } },
  },
  // common-pure — 순수 데이터 sink. 자기 자신만 참조.
  {
    from: { type: "common-pure" },
    allow: { to: { type: "common-pure" } },
  },
  // infrastructure — common만 참조 가능 (모듈 로직에 의존하면 안 됨)
  {
    from: { type: "infrastructure" },
    allow: { to: { type: ["infrastructure", "common", "common-pure"] } },
  },
  // libs — 독립 라이브러리 모듈. 앱 전체를 조립할 수 있도록 모든 레이어 접근 허용
  {
    from: { type: "libs" },
    allow: {
      to: {
        type: [
          "model",
          "port",
          "service",
          "controller",
          "strategy",
          "provider",
          "exception",
          "dto",
          "common",
          "common-pure",
          "infrastructure",
          "libs",
        ],
      },
    },
  },
];

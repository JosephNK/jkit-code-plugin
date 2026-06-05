// SCAFFOLD — generated once by jkit nextjs-openapi-gen, then yours to edit.
// Source: jkit nextjs-openapi-gen
// 인증 헤더·401 refresh·인터셉터 등 비즈니스 로직을 여기에 채워넣으세요.
// 재실행 시 보존되며, --force-client 명시 시에만 덮어씁니다.

import ky, { type Hooks, type KyInstance, type Options } from "ky";

const API_PROXY_PATH = "/api/proxy";

const DEFAULT_RETRY: Options["retry"] = {
  limit: 2,
  methods: ["get"],
  statusCodes: [408, 429, 500, 502, 503, 504],
};

// 앱별로 다르게 주입하는 설정. 모노레포에서 공유 패키지를 쓸 때 apps/a·apps/b가
// 각자 apiUrl·proxyPath·hooks(인증·401 refresh·인터셉터)를 넘겨 동일 service를
// 서로 다른 설정으로 공유한다.
export interface ApiClientConfig {
  apiUrl?: string; // 서버사이드 base URL (브라우저는 proxyPath를 거치므로 무시)
  proxyPath?: string; // 브라우저 프록시 경로 (기본 `/api/proxy`)
  hooks?: Hooks; // ky hooks — 인증 헤더·401 refresh·인터셉터
  retry?: Options["retry"]; // 기본 override
  timeout?: Options["timeout"];
  headers?: Record<string, string>;
}

// 브라우저는 proxyPath를 거치므로 apiUrl을 무시하고, 서버(SSR·route handler)에서만
// apiUrl로 백엔드에 직통한다.
function getPrefix(apiUrl: string, proxyPath: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${proxyPath}`;
  }

  if (!apiUrl) {
    throw new Error("server-side API base URL is required");
  }
  return apiUrl;
}

// config를 주입받아 KyInstance를 만든다. 멀티 앱은 각 앱이 자기 config로 호출한다.
export function createApiClient(config: ApiClientConfig = {}): KyInstance {
  return ky.create({
    prefix: getPrefix(config.apiUrl ?? "", config.proxyPath ?? API_PROXY_PATH),
    retry: config.retry ?? DEFAULT_RETRY,
    timeout: config.timeout ?? 30_000,
    headers: { Accept: "application/json", ...config.headers },
    hooks: config.hooks,
  });
}

// 단일 앱 편의용 싱글톤. 최초 1회 config로 초기화되고 이후 동일 인스턴스를 반환한다.
// 멀티 앱이면 각 앱이 createApiClient(config)로 자기 인스턴스를 만들어 쓰는 걸 권장.
let api: KyInstance | null = null;

export function getApi(config?: ApiClientConfig): KyInstance {
  if (api === null) {
    api = createApiClient(config);
  }
  return api;
}

export function resetApiInstance(): void {
  api = null;
}

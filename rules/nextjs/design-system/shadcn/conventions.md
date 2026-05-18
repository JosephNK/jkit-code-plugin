## shadcn/ui

All UI components **MUST** use shadcn/ui (Tailwind CSS **v4 or higher** + Base UI primitives).

- Minimum versions: `"tailwindcss": "^4.0.0"`, `"@base-ui/react": "^1.0.0"`, `"class-variance-authority": "^0.7.0"`, `"clsx": "^2.0.0"`, `"tailwind-merge": "^3.0.0"`
- React **19 or higher** is required (Next.js 16 baseline)
- shadcn/ui is **not an npm package** — components are scaffolded into `src/components/ui/` via the CLI and owned by the project
- **UI components** (buttons, inputs, text, layout, feedback, etc.) **MUST use shadcn/ui** — semantic HTML (`<form>`, `<section>`, `<nav>`, etc.) is allowed as-is
- Add components via `npx shadcn@latest add <component>` (e.g., `npx shadcn@latest add button dialog`) — do not hand-roll primitives that shadcn already ships
- Style preset: `base-nova` (Tailwind v4 기본). 구버전 `default` style은 deprecated.
- Primitive layer: `@base-ui/react` (Radix UI팀이 만든 후속 라이브러리). 구 `@radix-ui/*` 패키지는 사용하지 않는다.
- Theme customization: edit CSS variables (OKLCH tokens: `--background`, `--foreground`, `--primary`, etc.) in `src/app/globals.css`; tweak component variants directly in `src/components/ui/*`
- Class composition: always use the `cn()` helper (`clsx` + `tailwind-merge`) from `@/lib/utils/cn` instead of bare template strings to keep Tailwind class precedence correct
- Icons: `lucide-react`
- Animation utilities: `tw-animate-css` (Tailwind v4용 `tailwindcss-animate` 후속)
- Docs: https://ui.shadcn.com/

### Initial Setup

```bash
# 1. 프로젝트 초기화 — components.json, src/lib/utils/cn.ts, globals.css 토큰 생성
npx shadcn@latest init --defaults

# 2. 전체 컴포넌트 일괄 설치 — 이후 CLI 재호출 불필요
npx shadcn@latest add --all -y
```

`init`은 `components.json` (alias + style config), `src/lib/utils/cn.ts` (`cn()` helper), `globals.css`의 CSS variable 토큰을 생성한다. Tailwind v4은 별도 config 파일 없이 `@import "tailwindcss"` 한 줄로 동작한다.

`add --all -y`은 현재 `style: base-nova` 레지스트리의 **모든 컴포넌트**를 `src/components/ui/`로 한 번에 스캐폴딩한다. 컴포넌트는 프로젝트 소유 코드라 이후 자유롭게 수정·확장 가능하며, 신규 레지스트리가 추가되지 않는 한 CLI를 다시 부를 일이 없다.

> **Boundary 패치 필수**: shadcn 컴포넌트(`src/components/ui/*`, `shared-ui` 레이어)는 `@/lib/utils/cn`(`lib-shared` 레이어)을 import 한다. 기본 boundary 규칙은 `shared-ui → lib-shared`를 허용하지 않으므로 `eslint.config.mjs`의 `patchBoundaryRules`에 `{ from: "shared-ui", allow: { to: { type: "lib-shared" } } }`를 추가해야 한다.
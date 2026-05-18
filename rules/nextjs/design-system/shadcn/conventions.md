## shadcn/ui

All UI components **MUST** use shadcn/ui (Tailwind CSS **v4 or higher** + Radix UI primitives).

- Minimum versions: `"tailwindcss": "^4.0.0"`, `"class-variance-authority": "^0.7.0"`, `"clsx": "^2.0.0"`, `"tailwind-merge": "^2.0.0"`
- React **18 or higher** is required
- shadcn/ui is **not an npm package** — components are scaffolded into `src/components/ui/` via the CLI and owned by the project
- **UI components** (buttons, inputs, text, layout, feedback, etc.) **MUST use shadcn/ui** — semantic HTML (`<form>`, `<section>`, `<nav>`, etc.) is allowed as-is
- Add components via `npx shadcn@latest add <component>` (e.g., `npx shadcn@latest add button dialog`) — do not hand-roll primitives that shadcn already ships
- Theme customization: edit CSS variables (HSL tokens: `--background`, `--foreground`, `--primary`, etc.) in `src/app/globals.css`; tweak component variants directly in `src/components/ui/*`
- Class composition: always use the `cn()` helper (`clsx` + `tailwind-merge`) from `@/lib/utils` instead of bare template strings to keep Tailwind class precedence correct
- Icons: `lucide-react`
- Docs: https://ui.shadcn.com/

### Initial Setup

```bash
npx shadcn@latest init
```

The CLI generates `components.json` (alias + style config), `src/lib/utils.ts` (`cn()` helper), and updates `globals.css` + Tailwind config with CSS-variable tokens. Re-run `npx shadcn@latest add <component>` to scaffold each component into `src/components/ui/`.

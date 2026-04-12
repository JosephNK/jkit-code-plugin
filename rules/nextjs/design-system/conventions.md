## Design System

Implement UI based on `DESIGN.md` using Mantine theme API.

- Refer to `DESIGN.md` for colors, typography, component styles, and layout when implementing UI
- Reflect `DESIGN.md` color palette, border-radius, and spacing in the Mantine theme (`src/theme.ts`)
- **Mantine is the implementation standard** — `DESIGN.md` is a design reference; implement using Mantine API/components
- **Fonts**: Inter Variable (display/body, sohne-var replacement, `@fontsource-variable/inter`) + Pretendard (Korean fallback, `pretendard` npm) + Source Code Pro Variable (monospace, `@fontsource-variable/source-code-pro`)
- **Color scheme**: Light/dark (`defaultColorScheme="auto"` — follows system preference)
- **Conservative radius**: `defaultRadius: 'sm'` (4px) — range 4px–8px, no pill shapes
- **Blue-tinted shadows**: Multi-layer shadows using `rgba(50,50,93,0.25)` — brand-colored depth
- **Theme mapping**: Map `DESIGN.md` values to `createTheme()` in `src/theme.ts` as follows:
  - Color Palette → `theme.colors.stripe` (purple scale), `theme.colors.dark` (dark mode surfaces), `theme.black` (`#061b31` deep navy)
  - Border Radius → `theme.radius` (4px default, 8px max for featured elements)
  - Shadows → `theme.shadows` (blue-tinted multi-layer)
  - Typography → `theme.fontFamily` (Inter + Pretendard), `theme.fontFamilyMonospace` (Source Code Pro)
  - Headings → `fontWeight: '300'` (Stripe's signature light weight)
- **Component style overrides**: Component-specific styles from `DESIGN.md` go in `theme.components` as global overrides — do not repeat inline styles on individual components
- **Button labels**: Inter, weight 400, normal case (no uppercase)

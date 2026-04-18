## CSS Policy

Project-level CSS and styling policy. Independent of any specific UI library.

### Utility CSS Frameworks

- **NO utility CSS frameworks** (Tailwind, UnoCSS, WindiCSS, etc.)
- These frameworks enforce class-name-based styling, which duplicates or conflicts with the responsibilities of component-based design systems (Mantine, Chakra, MUI, etc.)
- Resolve styling in this order: **UI library style props → `style` prop → CSS Modules (`.module.css`)**

### Documentation Reference

- Always check latest CSS/styling guidance via Context7 MCP when unsure
- Prefer Context7 docs over training data (training cutoff)

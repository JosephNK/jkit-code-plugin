## CSS Policy

Project-level CSS and styling policy. Independent of any specific UI library.

### Utility CSS Frameworks

- **NO utility CSS frameworks** (Tailwind, UnoCSS, WindiCSS, etc.)
- 해당 프레임워크들은 클래스명 기반 스타일링을 강제하여 컴포넌트 기반 디자인 시스템(Mantine/Chakra/MUI 등)과 책임이 중복되거나 충돌한다
- 스타일링은 **UI 라이브러리의 style props → `style` prop → CSS Modules (`.module.css`)** 순으로 해결한다

### Documentation Reference

- Always check latest CSS/styling guidance via Context7 MCP when unsure
- Prefer Context7 docs over training data (training cutoff)

---
name: flutter-design
description: Create distinctive, production-grade Flutter interfaces with high design quality. Use this skill when the user asks to build Flutter widgets, screens, or applications. Generates creative, polished Dart code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade Flutter interfaces that avoid generic "AI slop" aesthetics. Implement real working Dart code with exceptional attention to aesthetic details and creative choices.

The user provides Flutter UI requirements: a widget, screen, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Arguments

| Argument | Description |
|----------|-------------|
| `--plan` | After outputting the design concept, invoke the planner agent to create a detailed implementation plan. Without this flag, only the design concept is output. |

Usage examples:
- `/flutter-design` → Design concept only (default)
- `/flutter-design --plan` → Design concept + planner agent

## Project Design System

This project uses `flutter_leaf_component` as its UI component library. ALWAYS leverage the existing design system:

### Design Tokens (via LeafTheme)
Access tokens through BuildContext extensions:
- `context.leafColors` → LeafColors (semantic color tokens: primary, secondary, surface, error, success, warning, info)
- `context.leafTypography` → LeafTypography (Material Design 3 based, 15 TextStyles: display/headline/title/body/label)
- `context.leafSpacing` → LeafSpacing (xs:2, sm:4, md:8, lg:12, xl:16, xxl:24, xxxl:32)
- `context.leafElevation` → LeafElevation (none/xs/sm/md/lg/xl with box shadow presets)
- `context.leafRadius` → LeafRadius (none:0, sm:4, md:8, lg:12, xl:16, xxl:20, full:50)
- `context.leafDuration` → LeafDuration (fast:150ms, normal:250ms, slow:300ms, verySlow:450ms)

### Component Hierarchy (Atomic Design)
- **Atoms**: LeafText, LeafIcon, LeafBadge, LeafCard, LeafButton, LeafCheckBox, LeafRadio, LeafSwitch, LeafChip, LeafSlider, LeafIndicator, LeafSkeleton, LeafAnimated, LeafImage, LeafPainter
- **Molecules**: LeafTextField, LeafRatingBar, LeafAppBar, LeafTabs
- **Organisms**: LeafAccordion, LeafDialog, LeafBottomSheet, LeafToast, LeafNotification, LeafCalendar, LeafPage, LeafScroll, LeafPhoto, LeafPicker, LeafGrid
- **Templates**: LeafScreenStatefulWidget, LeafScreenStatelessWidget, LeafLayout, LeafNavigationBar, LeafPopScope

### Style Resolution Priority
```
Widget parameter > Component theme > Global token
```

Use `LeafThemeData.light()` or `LeafThemeData.dark()` as base, then customize with `copyWith()` and component-specific theme data classes (e.g., LeafButtonThemeData, LeafAppBarThemeData).

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (platform targets, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working Flutter/Dart code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Flutter Aesthetics Guidelines

Focus on:
- **Typography**: Use `google_fonts` package for distinctive, characterful font choices. Avoid defaulting to Roboto or system fonts. Pair a distinctive display font with a refined body font. Override `LeafTypography` styles via `LeafThemeData.copyWith()` when the design calls for unique type treatment.
- **Color & Theme**: Commit to a cohesive aesthetic. Customize `LeafColors` through `LeafThemeData` for consistency across the app. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Use `ColorScheme.fromSeed()` or hand-crafted color palettes that serve the design vision.
- **Motion**: Use Flutter's animation system for effects and micro-interactions. Leverage `LeafAnimated` atoms (bounce, expand, fade, flip, rotate, scale) and `LeafDuration` tokens for consistent timing. For complex animations, use `AnimationController` with `CurvedAnimation`. Use `Hero` transitions for navigation. Focus on high-impact moments: one well-orchestrated screen entrance with staggered reveals creates more delight than scattered micro-interactions.
- **Spatial Composition**: Unexpected layouts using `Stack`, `CustomMultiChildLayout`, `Transform`, and `SliverAppBar`. Asymmetry. Overlap via `Positioned`. Diagonal flow with `Transform.rotate`. Use `LeafSpacing` tokens for consistent rhythm. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Use `BoxDecoration` with gradient fills, `CustomPainter` for geometric patterns and textures, `ShaderMask` for gradient text and masked effects, `BackdropFilter` for blur/glass effects, `LeafElevation` shadow presets for layered depth, and `ClipPath` for creative shapes.

NEVER use generic AI-generated aesthetics like unmodified Material default themes, bare `Scaffold` with default AppBar styling, basic `ListView` without visual refinement, overused color schemes (particularly purple gradients on white backgrounds), predictable layouts and widget patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## Implementation Planning

> **Note**: This section ONLY applies when the `--plan` argument is provided. Without `--plan`, SKIP this entire section — output only the design concept and stop. Do NOT invoke the planner agent.

When `--plan` is provided, invoke the planner agent to create a detailed implementation plan after completing the design concept output above.

### Workflow

1. **Design Phase** (this skill): Generate the design concept — aesthetic direction, color palette, typography, layout composition, motion design, and component mapping.
2. **Planning Phase** (planner agent): Pass the full design output to the planner agent for a step-by-step implementation plan. *(Only when `--plan` is used)*

### How to Invoke

Use the Task tool with `subagent_type: "everything-claude-code:planner"` and pass the complete design output as context in the prompt. The prompt should include:

- The full design concept (aesthetic direction, colors, typography, layout, motion, etc.)
- The target file paths and component structure
- The project's design system context (LeafTheme tokens, Atomic Design components)
- Any user-specified constraints or requirements

Example Task prompt structure:
```
Based on the following Flutter design concept, create a detailed implementation plan:

[Full design concept output here]

Project uses flutter_leaf_component (Atomic Design: Atoms, Molecules, Organisms, Templates).
Design tokens accessed via context.leafColors, context.leafTypography, context.leafSpacing, etc.

Create a phased implementation plan with:
- File structure and component hierarchy
- Implementation order (dependencies first)
- Specific widgets and design tokens to use per component
- Animation and interaction details
- Risk areas and technical considerations
```

### Expected Output

The planner agent should produce:
- **Phase breakdown**: Ordered implementation steps with dependencies
- **File-by-file plan**: What each file contains and its responsibility
- **Component mapping**: Which LeafComponent atoms/molecules/organisms to use
- **Token usage**: Specific design tokens (colors, spacing, typography, radius) per component
- **Animation plan**: Timing, curves, and trigger points for each motion element

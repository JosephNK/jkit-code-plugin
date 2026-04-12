---
description: Initialize JKit in current project
argument-hint: <framework> (nextjs | nestjs | flutter)
---

# JKit Init

Initialize JKit configuration for the current project using generator scripts.

## Arguments

- `framework` (required): one of `nextjs`, `nestjs`

## Steps

### 1. Ask framework

If no framework argument is provided, ask the user to select one: `nextjs`, `nestjs`, or `flutter`.

### 2. Ask project name

Ask the user for the project name. Default: current directory name.

### 3. Ask conventions stacks

Show available conventions stacks for the selected framework and ask the user to select (comma-separated, or empty for base only).

**Next.js:** `mantine`, `design-system`, `tanstack-query`, `next-proxy`
**NestJS:** `typeorm`

### 4. Ask ESLint stacks

Show available ESLint stacks for the selected framework and ask the user to select (comma-separated, or empty for base only).

**Next.js:** `mantine`, `mongodb`, `nextauth`, `email-template`, `tanstack-query`, `next-proxy`, `theme`
**NestJS:** `typeorm`, `gcp`, `anthropic-ai`, `local-rules`

### 5. Ask tsconfig stacks

Show available tsconfig stacks for the selected framework and ask the user to select (comma-separated, or empty for base only).

**Next.js:** (none)
**NestJS:** `typeorm`

### 6. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory. All output goes to the current project directory (`.`).

```bash
# 1. AGENTS.md + CLAUDE.md symlink
./scripts/gen-agents.sh <framework> -p . -n "<project-name>"

# 2. GIT.md
./scripts/gen-git.sh -p .

# 3. ARCHITECTURE.md
./scripts/gen-architecture.sh <framework> -p .

# 4. CONVENTIONS.md
./scripts/gen-conventions.sh <framework> -p . --with <conventions-stacks>

# 5. ESLint config
./scripts/gen-eslint.sh <framework> -p . --with <eslint-stacks>

# 6. tsconfig.json patch
./scripts/gen-tsconfig.sh <framework> -p . --with <tsconfig-stacks>
```

Skip `--with` if the user selected no stacks for that generator.

### 7. Add Project Stack to `AGENTS.md`

After generators complete, append a **Project Stack** section to `AGENTS.md` (before `### Reference`), with items based on the framework:

**Next.js:**
```markdown
### Project Stack
<!-- Fill in after init -->
- DB: 
- Auth: 
- UI: 
- State: 
```

**NestJS:**
```markdown
### Project Stack
<!-- Fill in after init -->
- DB: 
- Auth: 
- Queue: 
- Cache: 
```

### 8. Report

Tell the user what was created:
- `AGENTS.md` — AI agent entry point (fill in Project Stack section)
- `CLAUDE.md` → `AGENTS.md` symlink
- `GIT.md` — Git & GitHub guide
- `ARCHITECTURE.md` — Architecture details
- `CONVENTIONS.md` — Conventions with selected stacks
- `eslint.config.mjs` — ESLint config with selected stacks
- `tsconfig.json` — Patched with framework-specific settings

Remind them to fill in the **Project Stack** section in `AGENTS.md`.

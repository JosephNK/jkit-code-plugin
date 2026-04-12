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

Show the **conventions** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).

If `nextjs`:
> Available conventions stacks: `mantine`, `design-system`, `tanstack-query`, `next-proxy`

If `nestjs`:
> Available conventions stacks: `typeorm`

### 4. Ask ESLint stacks

Show the **ESLint** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).
**IMPORTANT: ESLint stacks are NOT the same as conventions stacks. You MUST show ALL items from the list below — do NOT omit any.**

If `nextjs` (7 items):
1. `mantine`
2. `mongodb`
3. `nextauth`
4. `email-template`
5. `tanstack-query`
6. `next-proxy`
7. `theme`

If `nestjs` (4 items):
1. `typeorm`
2. `gcp`
3. `anthropic-ai`
4. `custom-lint`

### 5. Ask tsconfig stacks

Show the **tsconfig** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).

If `nextjs`:
> Available tsconfig stacks: (none — base only, skip selection)

If `nestjs`:
> Available tsconfig stacks: `typeorm`

### 6. Ask AGENTS.md generation

Ask the user whether to generate `AGENTS.md` and `CLAUDE.md` symlink.
This step is optional because the user may need to customize these files.

If yes:
```bash
./scripts/gen-agents.sh <framework> -p . -n "<project-name>" --docs-dir docs
```

### 7. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory.

```bash
# 1. GIT.md
./scripts/gen-git.sh -p docs

# 2. ARCHITECTURE.md
./scripts/gen-architecture.sh <framework> -p docs

# 3. CONVENTIONS.md
./scripts/gen-conventions.sh <framework> -p docs --with <conventions-stacks>

# 4. ESLint config
./scripts/gen-eslint.sh <framework> -p . --with <eslint-stacks>

# 5. tsconfig.json patch
./scripts/gen-tsconfig.sh <framework> -p . --with <tsconfig-stacks>

# 6. Husky hooks
./scripts/gen-husky.sh <framework> -p .
```

Skip `--with` if the user selected no stacks for that generator.

### 8. Report

Tell the user what was created:
- `AGENTS.md` — AI agent entry point
- `CLAUDE.md` → `AGENTS.md` symlink
- `GIT.md` — Git & GitHub guide
- `ARCHITECTURE.md` — Architecture details
- `CONVENTIONS.md` — Conventions with selected stacks
- `eslint.config.mjs` — ESLint config with selected stacks
- `tsconfig.json` — Patched with framework-specific settings
- `.husky/` — Git hooks (pre-commit, commit-msg)

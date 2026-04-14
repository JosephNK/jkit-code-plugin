---
description: Initialize JKit in Next.js project
---

# JKit Next.js Init

Initialize JKit configuration for a Next.js project using generator scripts.

## Resolve plugin path

Before running any script, resolve the jkit plugin install path:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

All script paths below use `$JKIT_DIR` as the base directory.

## Steps

### 1. Ask project name

Ask the user for the project name. Default: current directory name.

### 2. Ask conventions stacks

Show the **conventions** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).

> Available conventions stacks: `mantine`, `design-system`, `tanstack-query`, `next-proxy`

### 3. Ask ESLint stacks

Show the **ESLint** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).
**IMPORTANT: ESLint stacks are NOT the same as conventions stacks. You MUST show ALL items from the list below — do NOT omit any.**

1. `mantine`
2. `mongodb`
3. `nextauth`
4. `email-template`
5. `tanstack-query`
6. `next-proxy`
7. `theme`

### 4. Ask tsconfig stacks

> Available tsconfig stacks: (none — base only, skip selection)

### 5. Ask AGENTS.md generation

Ask the user whether to generate `AGENTS.md` and `CLAUDE.md` symlink.
This step is optional because the user may need to customize these files.

If yes:
```bash
$JKIT_DIR/scripts/gen-agents.sh nextjs -p . -n "<project-name>" --docs-dir docs
```

### 6. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory.

```bash
# 1. GIT.md
$JKIT_DIR/scripts/gen-git.sh -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.sh nextjs -p docs

# 3. CONVENTIONS.md
$JKIT_DIR/scripts/gen-conventions.sh nextjs -p docs --with <conventions-stacks>

# 4. ESLint config
$JKIT_DIR/scripts/typescript/gen-eslint.sh nextjs -p . --with <eslint-stacks>

# 5. tsconfig.json patch
$JKIT_DIR/scripts/typescript/gen-tsconfig.sh nextjs -p .

# 6. Husky hooks
$JKIT_DIR/scripts/typescript/gen-husky.sh nextjs -p .
```

Skip `--with` if the user selected no stacks for that generator.

### 7. Report

Tell the user what was created:
- `AGENTS.md` — AI agent entry point
- `CLAUDE.md` → `AGENTS.md` symlink
- `GIT.md` — Git & GitHub guide
- `ARCHITECTURE.md` — Architecture details
- `CONVENTIONS.md` — Conventions with selected stacks
- `eslint.config.mjs` — ESLint config with selected stacks
- `tsconfig.json` — Patched with framework-specific settings
- `.husky/` — Git hooks (pre-commit, commit-msg)

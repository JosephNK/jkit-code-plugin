---
description: Initialize JKit in NestJS project
---

# JKit NestJS Init

Initialize JKit configuration for a NestJS project using generator scripts.

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

> Available conventions stacks: `typeorm`

### 3. Ask ESLint stacks

Show the **ESLint** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).
**IMPORTANT: ESLint stacks are NOT the same as conventions stacks. You MUST show ALL items from the list below — do NOT omit any.**

1. `typeorm`
2. `gcp`
3. `anthropic-ai`
4. `custom-lint`

### 4. Ask tsconfig stacks

Show the **tsconfig** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).

> Available tsconfig stacks: `typeorm`

### 5. Ask AGENTS.md generation

Ask the user whether to generate `AGENTS.md` and `CLAUDE.md` symlink.
This step is optional because the user may need to customize these files.

If yes:
```bash
$JKIT_DIR/scripts/gen-agents.sh nestjs -p . -n "<project-name>" --docs-dir docs
```

### 6. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory.

```bash
# 1. GIT.md
$JKIT_DIR/scripts/gen-git.sh -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.sh nestjs -p docs

# 3. CONVENTIONS.md
$JKIT_DIR/scripts/gen-conventions.sh nestjs -p docs --with <conventions-stacks>

# 4. ESLint config
$JKIT_DIR/scripts/typescript/gen-eslint.sh nestjs -p . --with <eslint-stacks>

# 5. tsconfig.json patch
$JKIT_DIR/scripts/typescript/gen-tsconfig.sh nestjs -p . --with <tsconfig-stacks>

# 6. Husky hooks
$JKIT_DIR/scripts/typescript/gen-husky.sh nestjs -p .
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

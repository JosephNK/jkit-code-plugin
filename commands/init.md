---
description: Initialize JKit in current project
argument-hint: <framework> (nextjs | flutter | nestjs)
---

# JKit Init

Initialize JKit configuration for the current project.

## Arguments

- `framework` (required): one of `nextjs`, `flutter`, `nestjs`

## Steps

### 1. Validate framework argument

If no framework is provided or it's not one of `nextjs`, `flutter`, `nestjs`, ask the user to specify one.

### 2. Create `.jkit/` directory and copy rules

1. Create the `.jkit/` directory
2. Copy rules from plugin:
   - `rules/common/git.md` → `.jkit/git.md`
   - `rules/{framework}/architecture.md` → `.jkit/architecture.md`
   - `rules/{framework}/conventions.md` → `.jkit/conventions.md`
   - `rules/{framework}/eslint.base.mjs` → `.jkit/eslint.base.mjs` (if exists)
3. Handle `eslint.config.mjs`:
   - **If not exists**: Create from `rules/{framework}/eslint.sample.mjs`
   - **If exists**: Backup to `eslint.config.mjs.bak`, then create new from `rules/{framework}/eslint.sample.mjs`. Notify the user: "Existing eslint.config.mjs backed up to eslint.config.mjs.bak. Please migrate your project-specific rules to the new file."
4. Create `PROJECT.md` in the project root with the following template:

```markdown
# Project Configuration

## Project
- Name: {project directory name}
- Framework: {framework}

## Stack
<!-- Project-specific libraries and tools -->
- DB: <!-- e.g., MongoDB, Supabase, PostgreSQL -->
- Auth: <!-- e.g., NextAuth, Firebase Auth -->
- UI: <!-- e.g., Mantine, Tailwind, Material UI -->
- State: <!-- e.g., TanStack Query, Zustand, Jotai -->

## Project-specific Files
<!-- Files unique to this project that don't follow the shared architecture -->
<!-- e.g., auth.ts (NextAuth config), proxy.ts (locale redirect) -->

## Notes
<!-- Any other project-specific details -->
```

### 3. Create `AGENTS.md`

Create `AGENTS.md` with the following content:

```markdown
# {project directory name}

### Project Specific
- [Project Config](PROJECT.md) — Read when you need project-specific context

### Reference
- [Architecture](.jkit/architecture.md) — **MUST read when creating a new module.** Architecture details with code examples
- [Conventions](.jkit/conventions.md) — **MUST read when writing or modifying code.** Conventions with code examples
- [Git](.jkit/git.md) — **MUST read when committing or using git/GitHub commands.** Git & GitHub guide with commit conventions
```

### 4. Create `CLAUDE.md` symlink

```bash
ln -sf AGENTS.md CLAUDE.md
```

### 5. Report

Tell the user what was created and remind them to fill in `PROJECT.md` with project-specific details.

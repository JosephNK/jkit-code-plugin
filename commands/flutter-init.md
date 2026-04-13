---
description: Initialize JKit in Flutter project
---

# JKit Flutter Init

Initialize JKit configuration for a Flutter project using generator scripts.

## Steps

### 1. Ask project name

Ask the user for the project name. Default: current directory name.

### 2. Ask conventions stacks

Show the **conventions** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).

> Available conventions stacks: `bloc`, `freezed`, `go-router`, `leaf-kit`, `easy-localization`

### 3. Ask pre-commit entry directory

Ask the user for the Flutter entry directory. Default: `app`.

### 4. Ask pyproject.toml options

Ask the user for:
- **description** (default: "Flutter project scripts")
- **author** (optional, e.g. "Name <email>")

### 5. Ask AGENTS.md generation

Ask the user whether to generate `AGENTS.md` and `CLAUDE.md` symlink.
This step is optional because the user may need to customize these files.

If yes:
```bash
./scripts/gen-agents.sh flutter -p . -n "<project-name>" --docs-dir docs
```

### 6. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory.

```bash
# 1. GIT.md
./scripts/gen-git.sh -p docs

# 2. ARCHITECTURE.md
./scripts/gen-architecture.sh flutter -p docs

# 3. CONVENTIONS.md
./scripts/gen-conventions.sh flutter -p docs --with <conventions-stacks>

# 4. .pre-commit-config.yaml
./scripts/flutter/gen-precommit.sh flutter -p . -entry <entry-dir>

# 5. pyproject.toml
./scripts/flutter/gen-pyproject.sh flutter -p . -n "<project-name>" -d "<description>" -a "<author>"

# 6. Utility scripts
./scripts/flutter/gen-scripts.sh -p .
```

Skip `--with` if the user selected no stacks for that generator.
Skip `-d` and `-a` in gen-pyproject.sh if the user did not provide them.

### 7. Install dependencies

```bash
poetry install
git config --local --unset-all core.hooksPath || true
poetry run pre-commit install
```

### 8. Report

Tell the user what was created:
- `AGENTS.md` — AI agent entry point
- `CLAUDE.md` → `AGENTS.md` symlink
- `GIT.md` — Git & GitHub guide
- `ARCHITECTURE.md` — Architecture details
- `CONVENTIONS.md` — Conventions with selected stacks
- `.pre-commit-config.yaml` — Pre-commit hooks (dart format, flutter analyze, flutter test)
- `pyproject.toml` — Poetry config for project scripts
- `scripts/flutter-build-deploy.sh` — Flutter build wrapper
- `scripts/update-dependencies.sh` — Dependencies update wrapper
- `scripts/update-leaf-kit-ref.sh` — Leaf kit ref update wrapper
- `scripts/android-show-info-keystore.sh` — Keystore info wrapper
- `scripts/android-signing-report.sh` — Signing report wrapper
- `scripts/android-signing-verify-apk.sh` — APK verify wrapper

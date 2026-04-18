---
description: Initialize JKit in Flutter project
---

# JKit Flutter Init

Initialize JKit configuration for a Flutter project using generator scripts.

## Resolve plugin path

Before running any script, resolve the jkit plugin install path:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

All script paths below use `$JKIT_DIR` as the base directory.

## Pin project root

**IMPORTANT**: Capture the project root **before** running any step, and `cd` into it at the start of every step that executes scripts or `poetry run` commands. cwd drift (e.g., a prior `cd app/` that was not reverted) is the most common cause of wrong-directory bugs (overwriting `app/AGENTS.md`, pre-commit hooks baking wrong config paths, etc.).

```bash
PROJECT_ROOT="$(pwd)"   # run this from the intended project root
```

Every shell block below assumes `cd "$PROJECT_ROOT"` has already been executed in that step.

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
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/gen-agents.sh flutter -p . -n "<project-name>" --docs-dir docs
```

### 6. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory.

```bash
cd "$PROJECT_ROOT"

# 1. GIT.md
$JKIT_DIR/scripts/gen-git.sh -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.sh flutter -p docs

# 3. CONVENTIONS.md
$JKIT_DIR/scripts/gen-conventions.sh flutter -p docs --with <conventions-stacks>

# 4. .pre-commit-config.yaml
$JKIT_DIR/scripts/flutter/gen-precommit.sh flutter -p . -entry <entry-dir>

# 5. pyproject.toml
$JKIT_DIR/scripts/flutter/gen-pyproject.sh flutter -p . -entry <entry-dir> -n "<project-name>" -d "<description>" -a "<author>"

# 6. Utility scripts
$JKIT_DIR/scripts/flutter/gen-scripts.sh -p . -entry <entry-dir>
```

Skip `--with` if the user selected no stacks for that generator.
Skip `-d` and `-a` in gen-pyproject.sh if the user did not provide them.

### 7. Install dependencies

**IMPORTANT**: Always `cd "$PROJECT_ROOT"` before `poetry run pre-commit install`. If cwd is wrong, the generated `.git/hooks/pre-commit` bakes in a wrong relative `--config` path and every subsequent commit fails with "No .pre-commit-config.yaml found".

```bash
cd "$PROJECT_ROOT"
poetry install
git config --local --unset-all core.hooksPath || true
poetry run pre-commit install
```

### 8. Inject architecture lint plugin (optional)

Ask the user whether to inject `architecture_lint` analyzer plugin. Default: **no**.

> `architecture_lint`는 레이어 의존성 규칙을 강제하는 커스텀 Dart analyzer plugin입니다. 프로젝트가 명확한 레이어 구조(clean architecture 등)를 따를 때 활성화를 권장합니다.

If yes, inject the plugin into the Flutter entry project. This must run **after** `poetry install` (requires `ruamel-yaml`).

```bash
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/flutter/gen-architecture-lint.sh flutter -p . -entry <entry-dir>
```

After injection, run `dart pub get` in the entry directory to resolve the new dependency:

```bash
cd "$PROJECT_ROOT/<entry-dir>" && dart pub get && cd "$PROJECT_ROOT"
```

If no, skip this step entirely. The user can install it later by running this command manually, or add `architecture_lint` to `dev_dependencies` in `pubspec.yaml` themselves.

### 9. Report

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
- `architecture_lint` (optional) — IDE analyzer plugin injected into `pubspec.yaml` + `analysis_options.yaml` (Step 8에서 yes 응답 시에만)

---
description: Update architecture_lint git ref in all pubspec.yaml files
---

# Flutter Update Architecture Lint Ref

Update the git ref version of `architecture_lint` dependency across all `pubspec.yaml` files in the project.

## Steps

### 1. Ask ref value

Ask the user for the new git ref value. Examples:
- Version tag: `v0.1.32`, `0.1.32` (auto-prefixed with `v`)
- Branch name: `main`, `develop`

Optionally ask if they want a dry-run first to preview changes without modifying files.

### 2. Run script

Run the script with the provided ref:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/dependencies/update_architecture_lint_ref.py <ref> --project-dir <user-project-dir> [--dry-run]
```

- `<ref>`: the new git ref value (e.g., `v0.1.32`, `main`)
- `<user-project-dir>`: the user's current working directory (absolute path)
- `--dry-run`: optional, preview changes without modifying files

### 3. Report

Show the update result to the user.
If dry-run was used, show which files would be changed and ask if they want to proceed with the actual update.
If the command fails, inform the user about the possible cause (e.g., no pubspec.yaml found, no architecture_lint dependency found).

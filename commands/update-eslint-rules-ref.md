---
description: Update @jkit/eslint-rules git ref in all package.json files
---

# Update @jkit/eslint-rules Ref

Update the git ref version of `@jkit/eslint-rules` (`github:JosephNK/jkit-code-plugin#<ref>`) across all `package.json` files in the project.

## Steps

### 1. Ask ref value

Ask the user for the new git ref value. Examples:
- Version tag: `v0.1.55`, `0.1.55` (auto-prefixed with `v`)
- Branch name: `main`, `develop`
- Leave empty / "auto" — uses the current plugin version from `.claude-plugin/plugin.json`

Optionally ask if they want a dry-run first to preview changes without modifying files.

### 2. Run script

Run the script with the provided ref (omit `<ref>` to auto-use plugin.json version):

```bash
cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/typescript/dependencies/update_eslint_rules_ref.py [<ref>] --project-dir <user-project-dir> [--dry-run]
```

- `<ref>`: optional new git ref value (e.g., `v0.1.55`, `main`). If omitted, the script reads `version` from `.claude-plugin/plugin.json` and prefixes `v`.
- `<user-project-dir>`: the user's current working directory (absolute path)
- `--dry-run`: optional, preview changes without modifying files

### 3. Report

Show the update result to the user.
If dry-run was used, show which files would be changed and ask if they want to proceed with the actual update.
If the command fails, inform the user about the possible cause (e.g., no package.json found, no @jkit/eslint-rules dependency found).

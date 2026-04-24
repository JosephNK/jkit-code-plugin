---
description: Update @jkit/code-plugin git ref in all package.json files
---

# Update @jkit/code-plugin Ref

Update the git ref version of `@jkit/code-plugin` (`github:JosephNK/jkit-code-plugin#<ref>`) across all `package.json` files in the project.

## Steps

### 1. Ask ref value

Ask the user for the new git ref value. Examples:
- Version tag: `v0.1.55`, `0.1.55` (auto-prefixed with `v`)
- Branch name: `main`, `develop`
- Leave empty / "auto" — uses the current plugin version from `.claude-plugin/plugin.json`

Optionally ask if they want a dry-run first to preview changes without modifying files.

### 2. Run script

Resolve the jkit plugin install path:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

Run the script with the provided ref (omit `<ref>` to auto-use plugin.json version):

```bash
$JKIT_DIR/scripts/typescript/dependencies/update-code-plugin-ref.mjs [<ref>] --project-dir <user-project-dir> [--dry-run]
```

- `<ref>`: optional new git ref value (e.g., `v0.1.55`, `main`). If omitted, the script reads `version` from `.claude-plugin/plugin.json` and prefixes `v`.
- `<user-project-dir>`: the user's current working directory (absolute path)
- `--dry-run`: optional, preview changes without modifying files

### 3. Report

Show the update result to the user.
If dry-run was used, show which files would be changed and ask if they want to proceed with the actual update.
If the command fails, inform the user about the possible cause (e.g., no package.json found, no @jkit/code-plugin dependency found).

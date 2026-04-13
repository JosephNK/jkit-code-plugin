---
description: Update Flutter package dependencies to latest versions
---

# Flutter Update Dependencies

Analyze and update Flutter package dependencies to their latest versions from pub.dev.

## Steps

### 1. Ask update options

Ask the user what they want to do:
- **Report only**: just show the dependency status without updating (`--report`)
- **Update all**: update all packages (default)
- **Update specific package**: update a single package (`--package <name>`)
- **Include major updates**: include major version updates (`--include-major`)
- **Exclude prefixes**: exclude packages with specific prefixes (`--exclude <prefix1> <prefix2>`)

### 2. Run script

Run the script with the selected options:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/dependencies/update_dependencies.py --project-dir <user-project-dir> [options]
```

- `<user-project-dir>`: the user's current working directory (absolute path)
- `[options]`: based on user selection:
  - `--report` for report only
  - `--package <name>` for a specific package
  - `--include-major` to include major updates
  - `--exclude <prefix1> <prefix2>` to exclude packages by prefix

### 3. Report

Show the analysis result to the user.
If updating, confirm before proceeding by passing without `--report`.
If the command fails, inform the user about the possible cause (e.g., no pubspec.yaml found, network error).

---
description: Update .pre-commit-config.yaml for Flutter project
---

# Flutter Update Pre-commit

Regenerate `.pre-commit-config.yaml` to update plugin paths and hook settings.

## Resolve plugin path

Before running any script, resolve the jkit plugin install path:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

## Steps

### 1. Ask entry directory

Ask the user for the Flutter entry directory. Default: `app`.

### 2. Run generator script

```bash
$JKIT_DIR/scripts/flutter/gen-precommit.mjs flutter -p . -entry <entry-dir>
```

### 3. Reinstall hooks

```bash
poetry run pre-commit install
```

### 4. Report

Tell the user that `.pre-commit-config.yaml` has been regenerated and hooks reinstalled.

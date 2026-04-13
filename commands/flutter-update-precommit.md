---
description: Update .pre-commit-config.yaml for Flutter project
---

# Flutter Update Pre-commit

Regenerate `.pre-commit-config.yaml` to update plugin paths and hook settings.

## Steps

### 1. Ask entry directory

Ask the user for the Flutter entry directory. Default: `app`.

### 2. Run generator script

```bash
./scripts/flutter/gen-precommit.sh flutter -p . -entry <entry-dir>
```

### 3. Reinstall hooks

```bash
poetry run pre-commit install
```

### 4. Report

Tell the user that `.pre-commit-config.yaml` has been regenerated and hooks reinstalled.

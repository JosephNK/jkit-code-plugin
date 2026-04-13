---
description: Show Android keystore information
---

# Flutter Keystore Info

Display Android keystore certificate information (validity, fingerprints, etc.).

## Steps

### 1. Ask keystore file path

Ask the user for the keystore file path.

Example: `my-release-key.keystore`, `app/android/release.keystore`

### 2. Run script

```bash
cd ${CLAUDE_PLUGIN_ROOT} && poetry run python features/flutter/scripts/android_show_info_keystore.py <keystore-path>
```

### 3. Report

Show the keystore information to the user.
If the command fails, inform the user about the possible cause (e.g., JDK not installed, keystore file not found).

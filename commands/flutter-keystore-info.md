---
description: Show Android keystore information
---

# Flutter Keystore Info

Display Android keystore certificate information (validity, fingerprints, etc.).

## Steps

### 1. Find keystore files

Search for keystore files (`*.keystore`, `*.jks`) in the current project directory and list them.

### 2. Ask keystore file path

If keystore files are found, show the list and let the user select one.
If no keystore files are found, ask the user to input the keystore file path manually.

Example: `my-release-key.keystore`, `app/android/release.keystore`

### 3. Verify and run script

Verify the selected keystore file exists, then run:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && poetry run python features/flutter/scripts/android_show_info_keystore.py <keystore-path> --project-dir <user-project-dir>
```

- `<keystore-path>`: keystore file name or relative path
- `<user-project-dir>`: the user's current working directory (absolute path)

### 4. Report

Show the keystore information to the user.
If the command fails, inform the user about the possible cause (e.g., JDK not installed, keystore file not found).

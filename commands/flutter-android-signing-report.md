---
description: Show Android keystore signing report
---

# Flutter Signing Report

Display detailed signing certificate information for a specific keystore alias.

## Steps

### 1. Find keystore files

Search for keystore files (`*.keystore`, `*.jks`) in the current project directory and list them.

### 2. Ask keystore info

If keystore files are found, show the list and let the user select one.
If no keystore files are found, ask the user to input the keystore file path manually.

Then ask for:
- **alias**: keystore alias (e.g., `my-key-alias`)
- **storepass**: keystore password
- **keypass**: key password

### 3. Verify and run script

Verify the selected keystore file exists, then run:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/flutter/keystore/android-signing-report-keystore.mjs <keystore-path> <alias> -s <storepass> -p <keypass> --project-dir <user-project-dir>
```

- `<keystore-path>`: keystore file name or relative path
- `<alias>`: keystore alias
- `<storepass>`: keystore password
- `<keypass>`: key password
- `<user-project-dir>`: the user's current working directory (absolute path)

### 4. Report

Show the signing report to the user.
If the command fails, inform the user about the possible cause (e.g., JDK not installed, keystore file not found, wrong alias or password).

---
description: Verify Android APK signature
---

# Flutter Verify APK

Verify APK digital signature and print certificate information.

## Steps

### 1. Find APK files

Search for APK files (`*.apk`) in the current project's build output directory and list them.

Default location: `build/app/outputs/flutter-apk/`

### 2. Ask APK file path

If APK files are found, show the list and let the user select one.
If no APK files are found, ask the user to input the APK file path manually.

### 3. Verify and run script

Verify the selected APK file exists, then run:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/keystore/android_signing_verify_apk.py <apk-path> --project-dir <user-project-dir>
```

- `<apk-path>`: APK file path (relative or absolute)
- `<user-project-dir>`: the user's current working directory (absolute path)

### 4. Report

Show the APK signature verification result to the user.
If the command fails, inform the user about the possible cause (e.g., Android SDK build-tools not installed, APK file not found).

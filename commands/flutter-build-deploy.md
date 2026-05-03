---
description: Build Flutter app for Android or iOS
---

# Flutter Build Deploy

Build a Flutter app for Android (APK/AppBundle) or iOS (IPA).

## Steps

### 1. Ask build options

Ask the user for the following:
- **Target OS**: `aos` (Android) or `ios` (iOS)
- **Flavor** (optional): build flavor (e.g., `production`, `staging`, `development`, `qa`, `appbundle`)
  - `appbundle`: Android AppBundle production build (iOS not supported)
  - 비워 두거나 생략하면 `--flavor` 없이 빌드 (단일-flavor 프로젝트)
- **Export options plist** (iOS only, optional): path to `ExportOptions.plist` file

### 2. Run script

Run the build script with the selected options:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/flutter/build/flutter-build-deploy.mjs <os> [<flavor>] --project-dir <user-project-dir> [options]
```

- `<os>`: `aos` or `ios`
- `<flavor>`: (optional) build flavor name. 생략 시 flavor 없이 빌드.
- `<user-project-dir>`: the user's current working directory (absolute path)
- `[options]`:
  - `--no-tree-shake-icons` to disable icon tree-shaking (enabled by default)
  - `--export-options-plist <path>` for iOS export options plist file

### 3. Report

Show the build result to the user.
If the command fails, inform the user about the possible cause (e.g., Flutter not installed, invalid flavor, iOS AppBundle not supported).

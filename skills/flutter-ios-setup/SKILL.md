---
name: flutter-ios-setup
description: Generates Flutter iOS build configuration files. Use for requests like "Set up iOS", "Configure iOS build", "Set up xcodeproj".
argument-hint: "<AppName> [-entry <dir>] [package_name]"
---

# Flutter iOS Setup Skill

Automatically configures iOS build settings for a Flutter project.
- project.pbxproj: Full replacement (4 flavors × 3 build types = 12 build configurations)
- Info.plist: Patch (only adds/modifies required settings in existing file)
- xcscheme: Creates 4 flavor-specific schemes, deletes existing Runner.xcscheme

## Arguments

- First value of `$ARGUMENTS`: App name (required, PascalCase, e.g. MyApp)
- `-entry <dir>`: Entry directory (optional, e.g. `-entry app`). Defaults to `ios/...` if omitted.
- Package name (optional, e.g. com.example.myapp). If omitted, extracted from the existing project.pbxproj PRODUCT_BUNDLE_IDENTIFIER.

## Workflow

1. **Parse arguments**: Extract App name, `-entry` option, and package name from `$ARGUMENTS`
   - If `-entry app` is present, set entry directory to `app`
   - If `-entry` is absent, use `ios/...` as base path
2. **Determine package name**: If package name is omitted
   - Extract `PRODUCT_BUNDLE_IDENTIFIER` value from `{entry}/ios/Runner.xcodeproj/project.pbxproj`
   - If the file doesn't exist, prompt the user for the package name
3. **Install dependencies** (once):
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry install --quiet
   ```
4. **Generate project.pbxproj** (full replacement): Generate template code with the following command
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_ios_pbxproj_template.py <AppName> <package_name> {entry}/ios/Runner.xcodeproj/project.pbxproj
   ```
   Save the output to `{entry}/ios/Runner.xcodeproj/project.pbxproj`
5. **Patch Info.plist** (modify existing file): Generate patched code with the following command
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && node scripts/flutter/setup/flutter-ios-info-plist-setup.mjs {entry}/ios/Runner/Info.plist
   ```
   Save the output to `{entry}/ios/Runner/Info.plist`
6. **Generate xcschemes** (4 flavors): Generate a scheme for each flavor with the following commands
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_ios_xcscheme_template.py production
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_ios_xcscheme_template.py development
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_ios_xcscheme_template.py staging
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_ios_xcscheme_template.py qa
   ```
   Save each output to `{entry}/ios/Runner.xcodeproj/xcshareddata/xcschemes/{flavor}.xcscheme`
7. **Delete existing Runner.xcscheme**: Delete `{entry}/ios/Runner.xcodeproj/xcshareddata/xcschemes/Runner.xcscheme` (if exists)
8. **Verify results**: Display the list of created/modified files to the user and provide `pod install` instructions

## Target Files

When running `/flutter-ios-setup MyApp -entry app com.example.myapp`:
```
app/ios/
├── Runner.xcodeproj/
│   ├── project.pbxproj                              ← Full replacement (12 build configurations)
│   └── xcshareddata/xcschemes/
│       ├── Runner.xcscheme                          ← Deleted
│       ├── production.xcscheme                      ← Newly created
│       ├── development.xcscheme                     ← Newly created
│       ├── staging.xcscheme                         ← Newly created
│       └── qa.xcscheme                              ← Newly created
└── Runner/
    └── Info.plist                                   ← Patched (preserves existing settings)
```

## Configuration Details

### project.pbxproj (full replacement)
Expands the default Flutter 3 build configurations (Debug/Release/Profile) to 12:
- 4 flavors: production, development, staging, qa
- 3 build types: Debug, Release, Profile
- 3 contexts: Project, Runner target, RunnerTests target = 36 total XCBuildConfigurations

Runner target build settings per flavor:

| Flavor | APP_DISPLAY_NAME | APP_URL_SCHEMES | PRODUCT_BUNDLE_IDENTIFIER |
|--------|-----------------|-----------------|---------------------------|
| production | `{AppName}` | `{scheme}` | `{package_name}` |
| development | `{AppName} (dev)` | `{scheme}-dev` | `{package_name}.dev` |
| staging | `{AppName} (stg)` | `{scheme}-stg` | `{package_name}.stg` |
| qa | `{AppName} (qa)` | `{scheme}-test` | `{package_name}.test` |

- DEVELOPMENT_TEAM: Automatically extracted from the existing project.pbxproj (set during flutter create)
- scheme: App name converted to lowercase (e.g. Vocabit → vocabit)

### Info.plist (patch - 2 items)
Reads the existing file and adds the following items if missing:
1. Change `CFBundleDisplayName` to build variable `$(APP_DISPLAY_NAME)`
2. Add `CFBundleURLTypes` block (deep link URL scheme: `$(APP_URL_SCHEMES)`)

### xcscheme (4 created)
Creates a separate Xcode scheme for each flavor:
- `production.xcscheme`: Debug-production / Release-production / Profile-production
- `development.xcscheme`: Debug-development / Release-development / Profile-development
- `staging.xcscheme`: Debug-staging / Release-staging / Profile-staging
- `qa.xcscheme`: Debug-qa / Release-qa / Profile-qa

## Usage Examples

```
/flutter-ios-setup MyApp -entry app com.example.myapp
→ Replace app/ios/Runner.xcodeproj/project.pbxproj (12 build configurations)
→ Patch app/ios/Runner/Info.plist
→ Create 4 schemes in app/ios/Runner.xcodeproj/xcshareddata/xcschemes/
→ Delete Runner.xcscheme
→ Provide pod install instructions

/flutter-ios-setup MyApp -entry app
→ Extract PRODUCT_BUNDLE_IDENTIFIER from existing project.pbxproj
→ Process same as above

/flutter-ios-setup MyApp
→ Uses ios/Runner.xcodeproj/... as base path (no entry)
→ Prompt user for package_name
```

## Prerequisites

- Should be run right after `flutter create`, before `pod install`
- Must run `pod install` after execution (CocoaPods automatically adds Pods-related settings)

## Notes

- project.pbxproj is fully replaced, so confirm with the user if custom settings exist
- Info.plist uses a patch approach, so existing settings are preserved (idempotent)
- Flavor configuration is fixed (production/staging/development/qa) - same across all projects
- Scheme is generated by converting the app name to lowercase (e.g. MyApp → myapp)
- If `-entry` is absent, uses `ios/...` as base path
- If `-entry app`, uses `app/ios/...` as base path
- DEVELOPMENT_TEAM is automatically extracted from the existing project.pbxproj (no separate input required)

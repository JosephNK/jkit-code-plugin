---
name: flutter-app-scaffold
description: Generates Flutter app initial configuration files. Use for requests like "Set up the app scaffold", "Flutter initial setup scaffold", "Create app.dart".
argument-hint: "<AppName> [-entry <dir>] [package_name]"
---

# Flutter App Scaffold Skill

Generates initial configuration files (app.dart, main.dart) for a Flutter project.

## Arguments

- First value of `$ARGUMENTS`: App name (required, PascalCase, e.g. Sample)
- `-entry <dir>`: Entry directory (optional, e.g. `-entry app`). Defaults to `lib/...` if omitted.
- Package name (optional, snake_case, e.g. sample_app). If omitted, auto-generated from the app name.

## Workflow

1. **Parse arguments**: Extract App name, `-entry` option, and package name from `$ARGUMENTS`
   - If `-entry app` is present, set entry directory to `app`
   - If `-entry` is absent, use `lib/...` as base path
2. **Install dependencies** (once):
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry install --quiet
   ```
3. **Generate router**: Generate router.dart with the following command
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/setup/flutter_route_setup.py -entry {entry}
   ```
4. **Generate localization resources**: Generate lang files and register pubspec.yaml assets
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/setup/flutter_assets_lang_setup.py -entry {entry}
   ```
5. **Generate app.dart**: Generate template code with the following command
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_app_template.py <AppName> [package_name]
   ```
6. **Generate main.dart**: Generate template code with the following command
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && poetry run python scripts/flutter/template/flutter_main_template.py <AppName> [package_name]
   ```
7. **Save files**:
   - Save app.dart template to `{entry}/lib/app.dart`
   - Save main.dart template to `{entry}/lib/main.dart`
8. **Initialize test file**:
   - If `{entry}/test/widget_test.dart` exists, clear its contents (make it an empty file)
9. **Verify results**: Display the list of generated files to the user

## Generated Files

When running `/flutter-app-scaffold Sample -entry app`:
```
app/
├── lib/
│   ├── app.dart       ← LeafTheme + MaterialApp.router based App widget
│   ├── main.dart      ← runZonedGuarded + BlocObserver + EasyLocalization initialization
│   └── router/
│       └── router.dart ← AppRouter (go_router)
├── test/
│   └── widget_test.dart ← Existing file contents cleared (empty file)
└── assets/langs/
    ├── en-US.json     ← English localization resource (empty JSON)
    ├── ja-JP.json     ← Japanese localization resource (empty JSON)
    └── ko-KR.json     ← Korean localization resource (empty JSON)
```

## Template Contents

### app.dart
- Wrapped with `LeafTheme`
- Uses `MaterialApp.router` (go_router integration)
- Applies `AppTheme.materialLight()` / `AppTheme.materialDark()` themes
- EasyLocalization integration (`localizationsDelegates`, `supportedLocales`, `locale`)

### main.dart
- Global error handling with `runZonedGuarded`
- `EasyLocalization.ensureInitialized()` call
- `Bloc.observer = LeafBlocObserver()` setup
- `FlutterError.onError` / `PlatformDispatcher.instance.onError` error interceptors
- Default locale: ko_KR, supported locales: en_US, ja_JP, ko_KR

### router.dart
- `AppRouter` class (private constructor)
- `GoRouter` based routing

## Usage Examples

```
/flutter-app-scaffold Sample -entry app
→ Create app/lib/app.dart (SampleApp class, package: sample_app)
→ Create app/lib/main.dart
→ Create app/lib/router/router.dart
→ Initialize app/test/widget_test.dart (empty file)
→ Create app/assets/langs/en-US.json
→ Create app/assets/langs/ja-JP.json
→ Create app/assets/langs/ko-KR.json
→ Register pubspec.yaml assets

/flutter-app-scaffold Sample
→ Create lib/app.dart (SampleApp class, package: sample_app)
→ Create lib/main.dart
→ Create lib/router/router.dart
→ Initialize test/widget_test.dart (empty file)
→ Create assets/langs/en-US.json
→ Create assets/langs/ja-JP.json
→ Create assets/langs/ko-KR.json
→ Register pubspec.yaml assets
```

## Notes

- If a file already exists, confirms with the user before overwriting
- If the App name doesn't have an `App` suffix, it's automatically appended (e.g. Sample → SampleApp)
- If package name is omitted, auto-generated as `{snake_case(app_name)}_app` format
- If `-entry` is absent, uses `lib/...`, `assets/...`, `pubspec.yaml` as base paths
- If `-entry app`, uses `app/lib/...`, `app/assets/...`, `app/pubspec.yaml` as base paths

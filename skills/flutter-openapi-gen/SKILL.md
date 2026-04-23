---
name: flutter-openapi-gen
description: Generates Dart code from OpenAPI 3.x specs. Use for requests like "Generate API client", "Create models from spec", "Set up API from swagger".
argument-hint: "<spec> <api_name> --output-dir <path> [--dry-run]"
---

<!--
OpenAPI 3.x specification files for code generation.
/flutter-openapi-gen specs/main.yaml main --output-dir packages/myapp_network/lib/
-->

# Flutter OpenAPI Code Generator Skill

Generates BuiltValue models, LeafDioService services, endpoints, and client initialization code from an OpenAPI 3.x specification.

## Arguments

- `spec` (required): OpenAPI spec file path or URL
- `api_name` (required): API name in snake_case (e.g., `main`, `auth`)
- `--output-dir <path>` (required): Code generation output path (e.g., `packages/myapp_network/lib/`)
- `--dry-run` (optional): Preview only, no files generated

## Workflow

1. **Parse arguments**: Extract spec path/URL, api_name, output-dir, dry-run from `$ARGUMENTS`
2. **Check/add pubspec dependencies**:
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && node scripts/flutter/openapi/update-pubspec.mjs {package_pubspec_path}
   ```
   - `{package_pubspec_path}`: output-dir 기준 `../pubspec.yaml` (예: `packages/myapp_network/pubspec.yaml`)
3. **Run flutter pub get**:
   ```bash
   flutter pub get
   ```
4. **Generate API code**:
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && node scripts/flutter/openapi/generate-api.mjs {spec} {api_name} --output-dir {output_dir} [--dry-run]
   ```
5. **Run build_runner** (skip if --dry-run):
   ```bash
   (cd {package_dir} && dart run build_runner clean && dart run build_runner build --delete-conflicting-outputs)
   ```
   - **중요**: 반드시 서브셸 `(...)` 로 감싸서 `cd`가 이후 단계의 작업 디렉토리에 영향을 주지 않도록 할 것
6. **Run dart format** (skip if --dry-run):
   ```bash
   dart format {output_dir}/src/api/{api_name}/
   ```
7. **Report results**: Show generated file summary

## Generated File Structure

```
{output-dir}/
├── src/
│   ├── api/
│   │   └── {api_name}/
│   │       ├── {api_name}_api.dart          # ← LeafDioClient init wrapper
│   │       ├── endpoints.dart               # ← baseUrl + paths constants
│   │       ├── models/
│   │       │   ├── index.dart               # ← models barrel export
│   │       │   └── src/                     # ← API별 BuiltValue DTOs
│   │       │       ├── user_model.dart      # ← schemas.User
│   │       │       ├── error_body_model.dart # ← schemas.ErrorBody
│   │       │       ├── status_enum.dart     # ← schemas.Status (enum)
│   │       │       └── serializers/
│   │       │           └── serializers.dart # ← @SerializersFor registry
│   │       └── services/
│   │           ├── index.dart               # ← services barrel export
│   │           └── src/                     # ← 태그별 서비스 파일
│   │               ├── user_management_service.dart  # ← tags["User Management"]
│   │               └── post_service.dart             # ← tags["Post"]
│   │
│   └── network.dart                         # All API clients entry point
│
└── {package_name}.dart                      # barrel exports
```

## Mapping Rules

| Swagger | Dart |
|---------|------|
| `servers[].url` | `endpoints.dart` baseUrl |
| `tags[].name` | Service class name ("User Management" → `UserManagementService`) |
| `components/schemas` | BuiltValue model (`User` → `UserModel`) |
| `schemas` (enum) | `EnumClass` with `@BuiltValueEnumConst(wireName:)` |
| `paths` | Service methods + endpoint constants |
| `responses.2xx.schema` | `R` type in `get<R, E>()` |
| `responses.4xx/5xx.schema` | `E` type or `errorParser` |
| `requestBody.schema` | BuiltValue request model with `serializers.serializeWith()` |

## Error Handling Strategy

| Error Definition | Generated Code |
|-----------------|----------------|
| No error schema | `get<R, Null>(path)` |
| All errors same schema | `get<R, E>(path)` |
| Different schemas per status | `get<R, Null>(path, errorParser: ...)` |

## Multi-spec Support

- Models directory is shared across all APIs
- Running a second spec merges models into existing serializers.dart
- network.dart includes all API clients

## Usage Examples

```
/flutter-openapi-gen specs/main.json main --output-dir packages/myapp_network/lib/

/flutter-openapi-gen https://api.example.com/v3/api-docs main --output-dir packages/myapp_network/lib/

/flutter-openapi-gen specs/auth.yaml auth --output-dir packages/myapp_network/lib/

/flutter-openapi-gen specs/main.json main --output-dir packages/myapp_network/lib/ --dry-run
```

## Notes

- Generated files have `// GENERATED CODE - DO NOT MODIFY BY HAND` header
- Re-running with the same spec produces identical output (idempotent)
- `--dry-run` shows planned files without creating them
- URL specs are saved to `specs/` for version control (JSON→`.json`, YAML→`.yaml`)

# Project Structure

```
Root (Melos workspace)
|-- app/
|   +-- lib/
|       |-- common/                      # Shared across all features
|       |   |-- env/                     # Environment config (envied)
|       |   |-- events/                  # App-wide event bus
|       |   |-- exceptions/              # Common exception definitions
|       |   |-- extensions/              # Dart extensions
|       |   |-- services/                # Cross-feature services
|       |   |   +-- <service>/           # Each follows Port & Adapter pattern
|       |   |       |-- *_port.dart
|       |   |       +-- *_adapter.dart
|       |   |-- theme/                   # Design system (colors, typography)
|       |   +-- widgets/                 # Common reusable widgets
|       |
|       |-- di/
|       |   +-- injection_container.dart # get_it service locator setup
|       |
|       |-- features/                    # Feature modules
|       |   +-- <feature>/
|       |       |-- domain/
|       |       |   |-- entities/        # Immutable value objects
|       |       |   |-- exceptions/      # Domain-specific exceptions
|       |       |   |-- ports/           # Abstract interfaces
|       |       |   +-- usecases/        # Business logic
|       |       |-- infrastructure/
|       |       |   +-- adapters/        # Port implementations
|       |       +-- presentation/
|       |           |-- pages/           # Screen entry points
|       |           |-- views/           # Composable view sections
|       |           +-- widgets/         # Feature-specific widgets
|       |
|       |-- router/
|       |   +-- router.dart             # GoRouter navigation config
|       |
|       |-- app.dart                     # App root widget, initialization
|       +-- main.dart                    # Entry point
|
+-- packages/
    +-- <network_package>/               # Auto-generated HTTP client (OpenAPI)
        +-- src/api/<api_name>/
            |-- models/                  # DTO models with JSON serialization
            |-- services/                # API service classes
            +-- endpoints.dart           # Endpoint definitions
```

## Test Structure

```
test/
|-- common/
|   +-- services/
|       +-- <service>_adapter_test.dart
|-- features/
|   +-- <feature>/
|       |-- domain/
|       |   +-- usecases/
|       |       +-- <verb>_<noun>_usecase_test.dart
|       |-- infrastructure/
|       |   +-- adapters/
|       |       +-- <name>_adapter_test.dart
|       +-- presentation/
+-- helpers/                             # Shared test utilities, mocks, fixtures
```

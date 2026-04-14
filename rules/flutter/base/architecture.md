# Hexagonal Architecture (Ports & Adapters)

This project follows Hexagonal Architecture. Core principle: **Business logic knows nothing about external infrastructure.**

## Layer Diagram

```
[Presentation]  pages/, views/, widgets/
        | depends on
        v
[UseCase]       usecases/
        | depends on
        v
[Port]          ports/                    <-- abstract interface
        ^ implements
        |
[Adapter]       adapters/                 -- concrete implementation
```

**Dependency direction**: Presentation -> UseCase -> Port <- Adapter. Adapters depend on Ports (implement them), not the other way around. This inversion keeps the domain layer free from infrastructure concerns.

## Data Flow

### Request (call direction)

```
Presentation        User interaction (button tap, pull-to-refresh, etc.)
    |
UseCase             Business logic (pure Dart, depends only on Ports)
    |
Port                Calls Adapter through interface
    |
Adapter Impl        Calls data source (API, local DB, platform SDK, etc.)
    |
Data Source          Remote API / Local DB / Platform Service
```

### Response (return direction)

```
Data Source          Raw response (JSON, DB row, SDK result, etc.)
    |
Raw Data Model      DTO (API) / DB Model (local) / SDK Result
    |
Adapter Impl        Raw data → Entity conversion via _toEntity()
    |
Entity              Immutable value object (domain model)
    |
UseCase             Applies business logic, returns Entity
    |
Presentation        Renders UI based on state
```

## Dependency Direction

```
Presentation -> UseCase -> Port (interface) <- Adapter Impl -> Data Source (API / DB / SDK)
                             |
                           Entity  <-  <-  <-  <-  <-  <-  <-
                          (all layers depend on this)
```

## Layer Details

### entities/ — Immutable Value Objects

The most stable layer. No runtime frameworks, no external packages.

### ports/ — Abstract Interfaces

Define contracts between domain and infrastructure. Ports use only domain types — no framework types allowed. Use `abstract class` (not `abstract interface class`).

### usecases/ — Business Logic

Orchestrate domain operations through Port interfaces. Each UseCase has a single responsibility and is invoked via `call()`.

### adapters/ — Port Implementations

Implement Port interfaces to communicate with data sources (Remote API, Local DB, Platform SDK, etc.). Responsible for raw data → Entity conversion.

### pages/, views/, widgets/ — Presentation

- **Screen** (pages/): Entry point for a route
- **View** (views/): Logical section of a screen (StatelessWidget)
- **Widget** (widgets/): Small reusable UI component within a feature

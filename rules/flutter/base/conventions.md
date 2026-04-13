# Conventions

## Dependency Rules

1. **entities/** imports only codegen annotations. No runtime frameworks, no external packages
2. **usecases/** depends on entities/ and ports/ only (no adapters, no presentation)
3. **adapters/** implements ports/ (may import external packages: network client, etc.)
4. **DI container** wires Port -> Adapter via get_it
5. No importing `dio`, `flutter_secure_storage`, or any external SDK in entities/, usecases/, ports/, exceptions/
6. No framework types in ports/ — convert to domain types (e.g., `Uint8List` instead of `MultipartFile`)
7. No circular dependencies between layers
8. No cross-feature imports of ports, adapters, usecases — use DI or event bus
9. No bare `catch` — always use `on ExceptionType catch (e)` to specify the exception type

## Feature Dependency Rules

1. Feature A **may** import Feature B's **entities** if they share domain concepts
2. Feature A **must NOT** import Feature B's ports, adapters, usecases directly
3. Cross-feature communication uses `common/events/` (app-wide event bus) only
4. If Feature A needs Feature B's business logic, inject Feature B's UseCase via DI — do not import the feature module directly

## common/ vs features/ Scope Rules

### common/services/ vs features/

| Location | When to use | Example |
|----------|-------------|---------|
| `common/services/` | Service used by **multiple features** or global infrastructure | Token storage, TTS, image compression |
| `features/<feature>/domain/ports/` | Port specific to **one feature's domain** | Product CRUD, order processing |

Both follow the same Port & Adapter pattern. The only difference is scope.

### common/widgets/ vs features/widgets/

| Location | When to use |
|----------|-------------|
| `features/<feature>/presentation/widgets/` | Widget used by **one feature only** |
| `common/widgets/` | Widget used by **2+ features** — promote from feature to common |

## Feature Types

| Type | Layers | Location | Description |
|------|--------|----------|-------------|
| Full-stack feature | domain/ + infrastructure/ + presentation/ | `features/<feature>/` | Has its own port, adapter, usecase, and UI |
| Presentation-only feature | presentation/ only | `features/<feature>/presentation/` | Reuses another feature's domain layer via DI (e.g., login screen uses auth usecases) |
| Shared domain module | entities/ + exceptions/ | `features/shared/domain/` | Shared domain objects with no full stack |

## Naming Convention

### Files

| Element | File Suffix | Example |
|---------|-------------|---------|
| Entity | `*.dart` | `user.dart`, `product.dart` |
| Port | `*_port.dart` | `product_port.dart` |
| Adapter | `*_adapter.dart` | `product_adapter.dart` |
| UseCase | `*_usecase.dart` | `get_products_usecase.dart` |
| UseCase Params | inline in usecase file or `*_params.dart` | `get_products_params.dart` |
| Screen | `*_screen.dart` | `product_screen.dart` |
| View | `*_view.dart` | `product_body_view.dart` |
| Widget | `*_{purpose}.dart` | `product_card.dart`, `product_list_tile.dart` |
| Exception | `*_exception.dart` | `server_exception.dart` |
| Test | `*_test.dart` | `product_adapter_test.dart` |

### Classes

| Element | Pattern | Example |
|---------|---------|---------|
| Entity | `{Name}` | `User`, `Product` |
| Port | `{Name}Port` | `ProductPort`, `AuthPort` |
| Adapter | `{Name}Adapter` | `ProductAdapter`, `AuthAdapter` |
| UseCase | `{Verb}{Noun}UseCase` | `GetProductsUseCase`, `CreateOrderUseCase` |
| UseCase Params | `{Verb}{Noun}Params` | `GetProductsParams`, `CreateOrderParams` |
| Screen | `{Feature}Screen` | `ProductScreen`, `LoginScreen` |
| View | `{Feature}{Purpose}View` | `ProductBodyView`, `ProductHeaderView` |
| Widget | `{Feature}{Purpose}` | `ProductCard`, `ProductListTile` |

### Adapter Private Methods

| Purpose | Pattern | Example |
|---------|---------|---------|
| DTO -> Entity conversion | `_toEntity()` or `_to{EntityName}()` | `_toProduct()`, `_toOrder()` |
| Complex parsing | `_parse{Name}()` | `_parseProductPage()` |

## UseCase Patterns

- Single responsibility: one business action per UseCase
- Execute via `call()` method (callable like a function)
- Omit parameters when none are needed
- Declare constructors as `const`

```dart
class CreateOrderUseCase {
  final OrderPort orderPort;
  const CreateOrderUseCase({required this.orderPort});

  Future<Order> call(CreateOrderParams params) async {
    return orderPort.createOrder(items: params.items);
  }
}
```

## Port & Adapter Patterns

- **Port**: `abstract class` with domain types only
- **Adapter**: implements Port, handles DTO -> Entity conversion via `_to{Entity}()` methods
- Multiple data sources (remote + local): combine in a single Adapter, fallback to cache on network failure

```dart
// Port
abstract class ProductPort {
  Future<ProductPage> getProducts({required int page, required int limit});
  Future<Product> getProductById({required String id});
}

// Adapter
class ProductAdapter implements ProductPort {
  @override
  Future<ProductPage> getProducts({required int page, required int limit}) async {
    final response = await apiClient.getProducts(page: page, limit: limit);

    if (response.isSuccessful && response.data != null) {
      return ProductPage(
        items: response.data!.items.map(_toProduct).toList(),
        total: response.data!.total,
      );
    }
    throw ServerException(response.error?.message ?? 'Failed');
  }

  Product _toProduct(ProductDto dto) => Product(
    id: dto.id, name: dto.name, price: dto.price, createdAt: dto.createdAt,
  );
}
```

## DI Registration

| Scope | Registration | Target |
|-------|-------------|--------|
| Cross-app services | `registerLazySingleton` | Stateful services shared across features |
| Feature Adapter | `registerFactory` | Port implementations |
| UseCase | `registerFactory` | Business logic units |

```dart
final sl = GetIt.instance;

void setupDependencies() {
  sl.registerLazySingleton<TokenStoragePort>(() => TokenStorageAdapter());
  sl.registerFactory<ProductPort>(() => ProductAdapter());
  sl.registerFactory(() => GetProductsUseCase(productPort: sl()));
}
```

## Error Handling

| Layer | Responsibility |
|-------|---------------|
| Adapter | Check response success. Throw `ServerException` for failures (403, 404, 429, 5xx). |
| UseCase | Let exceptions propagate. Add domain-specific validation errors if needed. |

```dart
class ServerException implements Exception {
  final String message;
  const ServerException(this.message);
  @override
  String toString() => message;
}
```

## Presentation

- **Screen** (pages/): Entry point for a route
- **View** (views/): Logical section of a screen (`StatelessWidget`)
- **Widget** (widgets/): Small reusable UI component within a feature

## Test Strategy

- Mocking: `mocktail` (`Mock`, `when`, `verify`)
- Test file structure mirrors `lib/`

```dart
class MockProductPort extends Mock implements ProductPort {}

void main() {
  late MockProductPort mockPort;
  late GetProductsUseCase useCase;

  setUp(() {
    mockPort = MockProductPort();
    useCase = GetProductsUseCase(productPort: mockPort);
  });

  test('delegates to port with correct params', () async {
    when(() => mockPort.getProducts(page: 1, limit: 20))
        .thenAnswer((_) async => mockPage);
    final result = await useCase(const GetProductsParams());
    expect(result, mockPage);
    verify(() => mockPort.getProducts(page: 1, limit: 20)).called(1);
  });
}
```

## File Size

- Recommended max: 400 lines
- Hard limit: 800 lines
